import { Buffer } from "buffer";
import process from "process";
// @ts-ignore
window.Buffer = window.Buffer || Buffer;
// @ts-ignore
window.process = window.process || process;
// @ts-ignore
(globalThis as any).global = (globalThis as any).global || globalThis;
