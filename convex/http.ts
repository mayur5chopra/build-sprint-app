import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { auth } from "./auth";
import { components } from "./_generated/api";
import { receive as receiveMetaWebhook, verify as verifyMetaWebhook } from "./metaWebhook";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/webhooks/meta", method: "GET", handler: verifyMetaWebhook });
http.route({ path: "/webhooks/meta", method: "POST", handler: receiveMetaWebhook });
registerStaticRoutes(http, components.staticHosting);

export default http;
