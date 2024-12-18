# Sensemaking tools

## Overview

Jigsaw’s [Sensemaking tools](https://medium.com/jigsaw/making-sense-of-large-scale-online-conversations-b153340bda55) help make sense of large-scale online conversations, leveraging LLMs to categorize comments, and summarize comments and voting patterns to surface actionable insights. There are currently three main functions:

- **Topic Learning** - identifies topics and optionally subtopics from a set of comments.
- **Categorization** - sorts comments into topics defined by a user or from the Topic Learning function. Comments can belong to more than one topic.
- **Summarization** - analyzes comments and optionally vote data to output a summary of the conversation, including areas of agreement and areas of disagreement.
  - Voting patterns can be passed in, aggregated either by opinion group or broken down by metadata about participants (e.g. demographic data)
  - Summaries are run through grounding routines, ensuring that claims are backed up by what was actually said in the conversation, and adding citations or references to surface representative comments.

Please see these [docs](https://jigsaw-code.github.io/sensemaking-tools) for a full breakdown of available methods and types. These tools are still in their beta stage.

### LLMs Used and Custom Models

This library is implemented using Google Cloud’s [VertexAI](https://cloud.google.com/vertex-ai). This means the library can be set up to use any model available on VertexAI’s Google Cloud’s [Model Garden](https://cloud.google.com/vertex-ai/generative-ai/docs/model-garden/explore-models), including the latest Gemini models, the open source model Gemma, and other models like Llama and Claude (full list [here](https://pantheon.corp.google.com/vertex-ai/model-garden)). The access and quota requirements are controlled by a user’s Google Cloud account.

In addition to models available through VertexAI’s Model Garden, users can integrate custom models using the library’s `Model` abstraction. This can be done by implementing a class with only two methods, one for generating plain text and one for generating structured data ([docs](https://jigsaw-code.github.io/sensemaking-tools/classes/models_model.Model.html) for methods). This allows for the library to be used with models not available in the Model Garden, with other cloud providers, and even with on-premise infrastructure for complete data sovereignty.

### Costs of Running

LLM pricing is based on token count and constantly changing. Here we list the token counts for a conversation with ~1000 comments. Please see [Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) for an up-to-date cost per input token. As of December 4, 2024 the cost for running topic learning, categorization, and summarization was in total under $5 on Gemini 1.5 Pro.

**Token Counts for a 1000 Comment Conversation**
| | Topic Learning | Categorization | Summarization |
| -------- | ------- | ------- | ------- |
| Input Tokens | 41,000 | 41,000 | 143,000 |
| Output Tokens | 1,000 | 26,000 | 25,000 |

## Running the tools - Setup

First make sure you have `npm` installed (`apt-get install npm` on Ubuntu-esque systems).

Next install the project modules by running:  
`npm install`

### Using the Default Models - GCloud Authentication

A Google Cloud project is required to control quota and access when using the default models that connect to Model Garden. Installation instructions for all machines are [here](https://cloud.google.com/sdk/docs/install-sdk#deb).

For Linux the GCloud CLI can be installed like:  
`sudo apt install -y google-cloud-cli`

Then to log in locally run:

`gcloud config set project <your project name here>`

`gcloud auth application-default login`

## Example Usage

Summarize Seattle’s $15 Minimum Wage Conversation.

```py
// Set up the tools to use the default Vertex model (Gemini Pro 1.5) and related authentication info.
const mySensemaker = new Sensemaker({
  defaultModel: new VertexModel(
    "myGoogleCloudProject123,
    "us-central1",
  ),
});

// Note: this function does not exist.
// Get data from a discussion in Seattle over a $15 minimum wage.
// CSV containing comment text, vote counts, and group information from: // https://github.com/compdemocracy/openData/tree/master/15-per-hour-seattle
const comments: Comments[] = getCommentsFromCsv("./comments.csv");

// Learn what topics were discussed and print them out.
const topics = mySensemaker.learnTopics(comments, true, // should include subtopics
    undefined, // there are no existing topics
    "This is from a conversation on a $15 minimum wage in Seattle" // additional context
);
console.log(topics);

// Summarize the conversation and print the result as Markdown.
const summary = mySensemaker.summarize(comments, SummarizationType.VOTE_TALLY, // there's vote information so vote tally summarization is the best summarization method to use.
topics, "This is from a conversation on a $15 minimum wage in Seattle" // additional context);
console.log(summary.getText("MARKDOWN"));
```

## Making Changes to the tools - Development

### Testing

Unit tests can be run with the following command:
`npm test`

To run tests continuously as you make changes run:
`npm run test-watch`

## Documentation

The documentation [here](https://jigsaw-code.github.io/sensemaking-tools) is the hosted version of the html from the docs/ subdirectory. This documentation is automatically generated using typedoc, and to update the documentation run:  
`npx typedoc`

## Feedback

If you have questions or issues with this library please leave feedback [here](https://docs.google.com/forms/d/e/1FAIpQLSd6kScXaf0d8XR7X9mgHBgG11DJYXV1hEzYLmqpxMcDFJxOhQ/viewform?resourcekey=0-GTVtn872epNsEHtI2ClBEA) and we will reach out to you. Our team is actively evaluating Sensemaking performance and is aiming to share our results on this page in the future. Please note that performance results may vary depending on the model selected.

## Cloud Vertex Terms of Use

This library is designed to leverage Cloud Vertex, and usage is subject to the [Cloud Vertex Terms of Service](https://cloud.google.com/terms/service-terms) and the [Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy).
