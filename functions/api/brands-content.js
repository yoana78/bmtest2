import defaultContent from "../../content/brands.json";
import { makeContentApi } from "../_lib/content-api.js";

const api = makeContentApi("brands-content", defaultContent);
export const onRequestGet = api.onRequestGet;
export const onRequestPut = api.onRequestPut;
