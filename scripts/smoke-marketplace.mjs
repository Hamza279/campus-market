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

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn8n2wAAAAASUVORK5CYII=",
  "base64",
);

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

const profileResponse = await request("/api/profile");
await assertOk("load current profile", profileResponse);
const profile = await profileResponse.json();

const updateProfileResponse = await request("/api/profile", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    name: "505 Smoke Seller",
    bio: "Smoke profile bio",
    campusAffiliation: "UNM student",
    neighborhood: "Nob Hill",
    meetupLocation: "Student Union",
    responseTime: "Within a few hours",
    interests: "Books, tech",
    contactPreference: "Message me in app first",
  }),
});
await assertOk("save current profile", updateProfileResponse);
const updatedProfile = await updateProfileResponse.json();
if (updatedProfile.name !== "505 Smoke Seller" || updatedProfile.meetupLocation !== "Student Union") {
  throw new Error("profile changes did not persist");
}
console.log("ok - profile save persists");

const publicProfileResponse = await request(`/api/profile/${profile.id}`);
await assertOk("load public seller profile", publicProfileResponse);
const publicProfile = await publicProfileResponse.json();
if (publicProfile.name !== "505 Smoke Seller" || publicProfile.bio !== "Smoke profile bio") {
  throw new Error("public profile did not reflect saved profile data");
}
console.log("ok - public profile shows saved data");

await assertOk("profile page with session", await request("/profile"));
await assertOk("public seller page route", await request(`/seller/${profile.id}`));

const uploadForm = new FormData();
uploadForm.set("image", new File([tinyPng], "smoke-image.png", { type: "image/png" }));
uploadForm.set("thumbnail", new File([tinyPng], "smoke-thumb.png", { type: "image/png" }));

const uploadResponse = await request("/api/uploads/listing-image", {
  method: "POST",
  headers: {
    Accept: "application/json",
  },
  body: uploadForm,
});
await assertOk("upload listing image", uploadResponse);
const uploadedImage = await uploadResponse.json();

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
    image: uploadedImage.imageUrl,
    imageUrl: uploadedImage.imageUrl,
    imageKey: uploadedImage.imageKey,
    thumbnailUrl: uploadedImage.thumbnailUrl,
    thumbnailKey: uploadedImage.thumbnailKey,
    status: "active",
  }),
});
await assertOk("create seller listing", createResponse);
const createdListing = await createResponse.json();
if (!createdListing.imageUrl || !createdListing.imageKey || !createdListing.thumbnailUrl || !createdListing.thumbnailKey) {
  throw new Error("created listing did not persist uploaded image fields");
}
console.log("ok - listing image fields persisted");

const publicListingsResponse = await request("/api/listings");
await assertOk("public listings include created item", publicListingsResponse);
const publicListings = await publicListingsResponse.json();
if (!publicListings.some((listing) => listing.id === createdListing.id)) {
  throw new Error("created listing was not found in public listings");
}
console.log("ok - public listings contain created listing");

const updateResponse = await request(`/api/listings/${createdListing.id}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    ...createdListing,
    title: `${createdListing.title} Updated`,
    price: "$2.00",
    description: "Updated smoke-test listing.",
  }),
});
await assertOk("update seller listing", updateResponse);
const updatedListing = await updateResponse.json();
if (updatedListing.title !== `${createdListing.title} Updated` || updatedListing.price !== "$2.00") {
  throw new Error("updated listing did not persist returned changes");
}
console.log("ok - listing update persists");

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

const loggedOutDashboard = await request("/dashboard");
if (loggedOutDashboard.status !== 302) {
  throw new Error(`dashboard should redirect after logout, got ${loggedOutDashboard.status}`);
}
console.log("ok - logout clears session");

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

const persistedUpdatedListing = sellerListings.find((listing) => listing.id === createdListing.id);
if (!persistedUpdatedListing || persistedUpdatedListing.title !== updatedListing.title || persistedUpdatedListing.price !== updatedListing.price) {
  throw new Error("updated seller listing did not persist after logout/login");
}
console.log("ok - updated seller listing persisted after logout/login");

const savedAfterReloginResponse = await request("/api/saved-listings");
await assertOk("saved listings persist after logout/login", savedAfterReloginResponse);
const savedAfterRelogin = await savedAfterReloginResponse.json();
if (!savedAfterRelogin.includes(createdListing.id)) {
  throw new Error("saved listing did not persist after logout/login");
}
console.log("ok - watchlist persisted after logout/login");

await assertOk("delete smoke listing", await request(`/api/listings/${createdListing.id}`, { method: "DELETE" }));

console.log(`Smoke tests passed against ${baseUrl}`);
