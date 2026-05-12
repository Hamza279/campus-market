const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:5173";
const smokeEmail = process.env.SMOKE_EMAIL || "smoke@example.edu";
const smokeName = process.env.SMOKE_NAME || "Smoke Tester";
const smokePassword = process.env.SMOKE_PASSWORD || "";

const cookies = new Map();

const updateCookies = (response) => {
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookie) {
    const [pair] = cookie.split(";");
    const [name, value] = pair.split("=");
    if (name && cookie.toLowerCase().includes("max-age=0")) {
      cookies.delete(name);
    } else if (name && value) {
      cookies.set(name, value);
    }
  }
};

const cookieHeader = () => {
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
};

const request = async (path, init = {}) => {
  const headers = new Headers(init.headers || {});
  if (cookies.size > 0) {
    headers.set("Cookie", cookieHeader());
  }

  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers,
    redirect: "manual",
  });
  updateCookies(response);
  return response;
};

const assertOk = async (label, response) => {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${await response.text()}`);
  }
  console.log(`ok - ${label}`);
};

await assertOk("home page", await request("/"));
await assertOk("browse page", await request("/listings"));
await assertOk("schema health", await request("/api/health/schema"));
await assertOk("public listings api", await request("/api/listings"));

const unauthSaved = await request("/api/saved-listings");
if (unauthSaved.status !== 401) {
  throw new Error(`saved listings should require login, got ${unauthSaved.status}`);
}
console.log("ok - saved listings require auth");

const loginForm = new URLSearchParams();
if (smokePassword) {
  loginForm.set("intent", "login");
  loginForm.set("email", smokeEmail);
  loginForm.set("password", smokePassword);
} else {
  loginForm.set("intent", "demo");
  loginForm.set("name", smokeName);
  loginForm.set("email", smokeEmail);
}
loginForm.set("returnTo", "/dashboard");

const loginResponse = await request("/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: loginForm.toString(),
});

if (loginResponse.status !== 302) {
  throw new Error(`login did not redirect: ${loginResponse.status} ${await loginResponse.text()}`);
}
console.log("ok - login creates session");

await assertOk("dashboard with session", await request("/dashboard"));
await assertOk("dashboard after refresh with same session", await request("/dashboard"));

const createResponse = await request("/api/listings", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    title: `Smoke test listing ${Date.now()}`,
    price: "$1.00",
    location: "Smoke Lab",
    condition: "Good",
    category: "Supplies",
    description: "Temporary smoke-test listing.",
    image: "",
    imageUrl: "",
    status: "active",
  }),
});
await assertOk("create seller listing", createResponse);
const createdListing = await createResponse.json();

await assertOk(
  "save listing to watchlist",
  await request("/api/saved-listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ listingId: createdListing.id }),
  }),
);

const savedResponse = await request("/api/saved-listings");
await assertOk("saved listings persist endpoint", savedResponse);
const savedIds = await savedResponse.json();
if (!savedIds.includes(createdListing.id)) {
  throw new Error("created listing was not found in saved listings");
}
console.log("ok - watchlist contains saved listing");

await request("/logout");
cookies.clear();

const reloginResponse = await request("/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: loginForm.toString(),
});
if (reloginResponse.status !== 302) {
  throw new Error(`re-login did not redirect: ${reloginResponse.status} ${await reloginResponse.text()}`);
}
console.log("ok - re-login creates session");

const sellerListingsResponse = await request("/api/listings?mine=1");
await assertOk("seller listings persist endpoint after logout/login", sellerListingsResponse);
const sellerListings = await sellerListingsResponse.json();
if (!sellerListings.some((listing) => listing.id === createdListing.id)) {
  throw new Error("created seller listing did not persist after logout/login");
}
console.log("ok - seller listing persisted after logout/login");

const savedAfterReloginResponse = await request("/api/saved-listings");
await assertOk("saved listings persist after logout/login", savedAfterReloginResponse);
const savedAfterRelogin = await savedAfterReloginResponse.json();
if (!savedAfterRelogin.includes(createdListing.id)) {
  throw new Error("saved listing did not persist after logout/login");
}
console.log("ok - watchlist persisted after logout/login");

await assertOk("delete smoke listing", await request(`/api/listings/${createdListing.id}`, { method: "DELETE" }));

console.log(`Smoke tests passed against ${baseUrl}`);
