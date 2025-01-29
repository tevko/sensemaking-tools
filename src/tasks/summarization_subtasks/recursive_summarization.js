"use strict";
// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecursiveSummary = void 0;
exports.resolvePromisesInParallel = resolvePromisesInParallel;
class RecursiveSummary {
    constructor(input, model, additionalContext) {
        this.input = input;
        this.model = model;
        this.additionalContext = additionalContext;
    }
}
exports.RecursiveSummary = RecursiveSummary;
/**
 * Resolves Promises sequentially, optionally using batching for limited parallelization.
 *
 * Batching can be used to execute mutiple promises in parallel that will then be resolved in
 * order. The batchSize can be though of as the maximum number of parallel threads.
 * @param promises the promises to resolve.
 * @param numParallelExecutions how many promises to resolve at once, the default is 2 based on the
 * current Gemini qps quotas, see: https://cloud.google.com/gemini/docs/quotas#per-second.
 * @returns A list of the resolved values of the promises.
 */
function resolvePromisesInParallel(promises_1) {
    return __awaiter(this, arguments, void 0, function* (promises, numParallelExecutions = 2) {
        const results = [];
        for (let i = 0; i < promises.length; i += numParallelExecutions) {
            const batch = promises.slice(i, i + numParallelExecutions);
            const batchResults = yield Promise.all(batch); // Resolve batch in parallel
            results.push(...batchResults); // Add batch results to the main results array
        }
        return results;
    });
}
