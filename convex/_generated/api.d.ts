/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as deliveryAdapters from "../deliveryAdapters.js";
import type * as http from "../http.js";
import type * as lib_reminderDemoCore from "../lib/reminderDemoCore.js";
import type * as lib_smritiCore from "../lib/smritiCore.js";
import type * as messages from "../messages.js";
import type * as metaWebhook from "../metaWebhook.js";
import type * as notes from "../notes.js";
import type * as profiles from "../profiles.js";
import type * as reminderWorker from "../reminderWorker.js";
import type * as reminders from "../reminders.js";
import type * as smriti from "../smriti.js";
import type * as smritiAi from "../smritiAi.js";
import type * as smritiDaily from "../smritiDaily.js";
import type * as smritiDeliveryAdapter from "../smritiDeliveryAdapter.js";
import type * as smritiWorker from "../smritiWorker.js";
import type * as tasks from "../tasks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  auth: typeof auth;
  chat: typeof chat;
  crons: typeof crons;
  deliveryAdapters: typeof deliveryAdapters;
  http: typeof http;
  "lib/reminderDemoCore": typeof lib_reminderDemoCore;
  "lib/smritiCore": typeof lib_smritiCore;
  messages: typeof messages;
  metaWebhook: typeof metaWebhook;
  notes: typeof notes;
  profiles: typeof profiles;
  reminderWorker: typeof reminderWorker;
  reminders: typeof reminders;
  smriti: typeof smriti;
  smritiAi: typeof smritiAi;
  smritiDaily: typeof smritiDaily;
  smritiDeliveryAdapter: typeof smritiDeliveryAdapter;
  smritiWorker: typeof smritiWorker;
  tasks: typeof tasks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
