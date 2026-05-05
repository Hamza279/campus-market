import { initClient, initClientNavigation } from "rwsdk/client";
import { loadStyles } from "./styles";

// RedwoodSDK uses RSC RPC to emulate client side navigation.
// https://docs.rwsdk.com/guides/frontend/client-side-nav/
const { handleResponse, onHydrated } = initClientNavigation();
void loadStyles();
initClient({ handleResponse, onHydrated });
