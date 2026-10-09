import test from "node:test";
import assert from "node:assert/strict";
import { seed, validate } from "../src/catalog.js";
test("three seeded styles exist",()=>assert.ok(seed.length>=3));
test("hex frame color accepted",()=>assert.deepEqual(validate({name:"Frame",frame_color:"#123ABC"}),[]));
test("invalid color rejected",()=>assert.ok(validate({name:"Frame",frame_color:"blue"}).length));
test("unknown field rejected",()=>assert.ok(validate({name:"Frame",admin:true}).length));
