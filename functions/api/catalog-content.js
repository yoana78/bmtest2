import defaultContent from "../../content/catalog.json";
import { makeContentApi } from "../_lib/content-api.js";

const api = makeContentApi("catalog-content", defaultContent);
export const onRequestGet = api.onRequestGet;
export const onRequestPut = api.onRequestPut;
