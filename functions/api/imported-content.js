import defaultContent from "../../content/imported-brands.json";
import { makeContentApi } from "../_lib/content-api.js";

const api = makeContentApi("imported-content", defaultContent);
export const onRequestGet = api.onRequestGet;
export const onRequestPut = api.onRequestPut;
