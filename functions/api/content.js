import defaultContent from "../../content/home.json";
import { makeContentApi } from "../_lib/content-api.js";

const api = makeContentApi("home-content", defaultContent);
export const onRequestGet = api.onRequestGet;
export const onRequestPut = api.onRequestPut;
