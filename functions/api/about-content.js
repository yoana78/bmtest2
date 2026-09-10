import defaultContent from "../../content/about.json";
import { makeContentApi } from "../_lib/content-api.js";

const api = makeContentApi("about-content", defaultContent);
export const onRequestGet = api.onRequestGet;
export const onRequestPut = api.onRequestPut;
