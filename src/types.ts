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

// This module defines a set a data types used throughout the library. These types are specified using
// TypeBox, which allows us to simultaneously generate TypeScript types for the codebase, together with
// JSON Schema specifications, useful for VertexAI/Gemini constrained decoding, as well as for data
// validation routines.

import { Type, TSchema, type Static } from "@sinclair/typebox";
import { TypeCheck, TypeCompiler } from "@sinclair/typebox/compiler";
import { formatCitations } from "./validation/grounding";

/**
 * TypeBox JSON Schema representation of a single topic record as a name, with no subtopics.
 */
export const FlatTopic = Type.Object({
  name: Type.String(),
  citations: Type.Array(Type.Number()),
});

/**
 * Type representation of a single topic record as a name, with no subtopics.
 */
export type FlatTopic = Static<typeof FlatTopic>;

/**
 * TypeBox JSON Schema representation of a topic record as a name, with flat subtopics.
 */
export const NestedTopic = Type.Object({
  name: Type.String(),
  citations: Type.Array(Type.Number()),
  subtopics: Type.Array(FlatTopic),
});

/**
 * Type representation of a topic record as a name, with flat subtopics.
 */
export type NestedTopic = Static<typeof NestedTopic>;

/**
 * TypeBox JSON Schema representation of an abstract topic, either with or without subtopics.
 */
export const Topic = Type.Union([FlatTopic, NestedTopic]);

/**
 * Type representation of an abstract topic, either with or without subtopics.
 */
export type Topic = Static<typeof Topic>;

/**
 * TypeBox JSON Schema representation of a comment id, together with a list of associated topics.
 */
export const TopicCategorizedComment = Type.Object({
  id: Type.String(),
  topics: Type.Array(FlatTopic),
});

/**
 * Type representation of a comment id, together with a list of associated topics.
 */
export type TopicCategorizedComment = Static<typeof TopicCategorizedComment>;

/**
 * TypeBox JSON Schema representation of a comment id, together with a list of associated topics and subtopics.
 */
export const SubtopicCategorizedComment = Type.Object({
  id: Type.String(),
  topics: Type.Array(NestedTopic),
});

/**
 * Type representation of a comment id, together with a list of associated topics and subtopics.
 */
export type SubtopicCategorizedComment = Static<typeof SubtopicCategorizedComment>;

/**
 * TypeBox JSON Schema representation of a comment id, together with a list of associated topics and possibly subtopics.
 */
export const CommentRecord = Type.Union([TopicCategorizedComment, SubtopicCategorizedComment]);

/**
 * Type representation of a comment id, together with a list of associated topics and possibly subtopics.
 */
export type CommentRecord = Static<typeof CommentRecord>;

/**
 * Describes the type of summarization to use.
 */
export enum SummarizationType {
  BASIC,
  VOTE_TALLY,
}

/**
 * Represents a portion of a summary, optionally linked to representative comments.
 */
export interface SummaryChunk {
  /**
   * The text content of this chunk of the summary.
   */
  text: string;

  /**
   * An optional array of comment IDs that are representative of this chunk.
   * These IDs can be used for grounding and providing context.
   * Could be empty for fluffy/connecting text (e.g., ", and also" between two verifiable points).
   */
  representativeCommentIds?: string[];
}

/**
 * Specifies the format for citations within a summary.
 *
 * XML includes ID only, MARKDOWN includes text and votes as well.
 *
 * EXAMPLES:
 *
 * Input chunks:
 *  - "Members of Group A want cleaner parks." with comment IDs [123, 345]
 *  - " However, they disagree..." with comment ID [678]
 *  - " and others favoring..." with comment ID [912]
 *
 * Output (XML format):
 *  Members of Group A want cleaner parks.<citation comment_id=123><citation comment_id=345>
 *   However, they disagree...<citation comment_id=678>
 *   and others favoring...<citation comment_id=912>
 *
 * Output (MARKDOWN format):
 *  Members of Group A want cleaner parks.[[123](## "I want a cleaner park\nVotes: group-1(Agree=15, Disagree=2, Pass=3)")[[345](## "Clean parks are essential.\nVotes: group-2(Agree=10, Disagree=5)")]
 *   However, they disagree...[[678](## "More trash cans would help.\nVotes: group-1(Agree=20, Disagree=1)")]
 *   and others favoring...[[912](## "Littering fines are the solution.\nVotes: group-2(Agree=12, Disagree=3, Pass=2)")]
 */
export type CitationFormat = "XML" | "MARKDOWN";

/**
 * Represents a summary composed of multiple chunks.
 * If a chunk contains a claim, it should be grounded by representative comments.
 */
export class Summary {
  /**
   * An array of SummaryChunk objects, each representing a part of the summary.
   */
  chunks: SummaryChunk[];
  comments: Comment[];

  constructor(chunks: SummaryChunk[], comments: Comment[]) {
    this.chunks = chunks;
    this.comments = comments;
  }

  /**
   * Returns the text of the summary, formatted according to the specified citation format.
   * @param format The desired format for citations. Can be "XML" or "MARKDOWN".
   * @returns The formatted summary text.  Throws an error if an unsupported format is provided.
   */
  getText(format: CitationFormat): string {
    let result = "";

    switch (format) {
      case "XML":
        for (const chunk of this.chunks) {
          result += `${chunk.text}`;
          if (chunk.representativeCommentIds) {
            for (const id of chunk.representativeCommentIds) {
              result += `<citation comment_id=${id}>`;
            }
          }
        }
        break;

      case "MARKDOWN":
        for (const chunk of this.chunks) {
          result += `${chunk.text}`;
          if (chunk.representativeCommentIds) {
            result += `[${chunk.representativeCommentIds.join(",")}]`;
          }
        }
        // Apply citation tooltips as markdown.
        result = formatCitations(this.comments, result);
        break;

      default:
        throw new Error(`Unsupported citation type: ${format}`);
    }

    return result;
  }
}

/**
 * Aggregates a number of individual votes.
 */
export class VoteTally {
  agreeCount: number;
  disagreeCount: number;
  passCount?: number;

  constructor(agreeCount: number, disagreeCount: number, passCount?: number) {
    this.agreeCount = agreeCount;
    this.disagreeCount = disagreeCount;
    this.passCount = passCount;
  }

  get totalCount(): number {
    return this.agreeCount + this.disagreeCount + (this.passCount || 0);
  }
}

/**
 * Checks if the data is a VoteTally object.
 *
 * It has the side effect of changing the type of the object to VoteTally if applicable.
 *
 * @param data - the object to check
 * @returns - true if the object is a VoteTally
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function isVoteTallyType(data: any): data is VoteTally {
  return (
    typeof data === "object" &&
    data !== null &&
    "agreeCount" in data &&
    typeof data.agreeCount === "number" &&
    "disagreeCount" in data &&
    typeof data.disagreeCount === "number" &&
    (!("passCount" in data) || typeof data.passCount === "number")
  );
}

/**
 * A text that was voted on by different groups.
 */
export interface Comment {
  id: string;
  text: string;
  voteTalliesByGroup?: { [key: string]: VoteTally };
  topics?: Topic[];
}

/**
 * Checks if the given object is a dictionary of group names to VoteTally objects.
 * @param data the object to check
 * @returns true if the object is a dictionary of groups to VoteTallys.
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function isVoteTallyByGroup(data: any): boolean {
  return (
    Object.keys(data).every((groupName: string) => typeof groupName === "string") &&
    Array.isArray(Object.values(data)) &&
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    Object.values(data).every((voteTally: any) => isVoteTallyType(voteTally))
  );
}

/**
 * Checks if the data is a Comment object.
 *
 * It has the side effect of changing the type of the object to Comment if applicable.
 *
 * @param data - the object to check
 * @returns - true if the object is a Comment
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function isCommentType(data: any): data is Comment {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof data.id === "string" &&
    "text" in data &&
    typeof data.text === "string" &&
    // Check that if voteTalliesByGroup dictionary exists all the keys are strings and values
    // are VoteTally objects.
    (!("voteTalliesByGroup" in data) || isVoteTallyByGroup(data.voteTalliesByGroup)) &&
    (!("topics" in data) || data.topics.every((topic: Topic) => isTopicType(topic)))
  );
}

/**
 * This is a local cache of compiled type/schema checkers. Checker compilation is not free, so
 * we keep a cache of previously compiled checkers so that we can more efficiently run checks.
 * Note that it's important here that this be a Map structure, for its specific value/identity
 * semantic guarantees on the input spec value.
 */
const schemaCheckerCache = new Map<TSchema, TypeCheck<TSchema>>();

/**
 * Check that the given data matches the corresponding TSchema specification. Caches type checking compilation.
 * @param schema The schema to check by
 * @param response The response to check
 * @returns Boolean for whether or not the data matches the schema
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function checkDataSchema(schema: TSchema, response: any): boolean {
  let checker: TypeCheck<TSchema> | undefined = schemaCheckerCache.get(schema);
  if (!checker) {
    checker = TypeCompiler.Compile(schema);
    schemaCheckerCache.set(schema, checker);
  }
  return checker.Check(response);
}

/**
 * Checks if the data is a CategorizedComment object.
 *
 * It has the side effect of changing the type of the object to CommentRecord if applicable.
 *
 * @param data - the object to check
 * @returns - true if the object is a Comment
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function isCommentRecordType(data: any): data is CommentRecord {
  return checkDataSchema(CommentRecord, data);
}

/**
 * Checks if the data is a Topic object.
 *
 * It has the side effect of changing the type of the object to Topic if applicable.
 *
 * @param data - the object to check
 * @returns - true if the object is a Topic
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function isTopicType(data: any): data is Topic {
  // This shouldn't be necessary, but checking directly against the union type seems to be ignoring
  // empty subtopic objects. This fixes it, but should maybe be reported as a bug?
  // TODO: Figure out why this is happening, and fix more optimally
  if ("subtopics" in data) {
    return checkDataSchema(NestedTopic, data);
  } else {
    return checkDataSchema(FlatTopic, data);
  }
}
