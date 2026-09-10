import defaultContent from "../../content/trust.json";
import { makeContentApi } from "../_lib/content-api.js";

const api = makeContentApi("trust-content", defaultContent);
export const onRequestGet = api.onRequestGet;
export const onRequestPut = api.onRequestPut;
