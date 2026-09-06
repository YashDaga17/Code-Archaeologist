# Problem: Lost Context in AI-Driven Development  

When AI coding agents work on code, the rationale behind changes often disappears. Checkpoints (saved by the Entire CLI on commit) *do* capture the full context – the linked commit, agent sessions, prompts and transcripts, tools used, files changed, etc. – but this data is rarely surfaced to developers. As a result, subsequent devs or agents have to reverse-engineer what the previous agent was trying to do. They may miss unfinished requirements or repeat work because the “why” and “what remains” aren’t clear.  

# Solution Overview: *Code Archaeologist*  

We will build **Code Archaeologist**, an AI system that turns Entire Checkpoint data into a developer workflow for reviews and handoffs. Using Entire’s data as input (prompts, transcripts, file diffs), it reconstructs each task’s intent, completed steps, and gaps. The AI will highlight *“promised vs delivered”*: any original requirement or intent in the transcript that isn’t reflected in the code. It will flag contradictions or missing tests, and link each claim back to the evidence (commit, file, or prompt) that created it. For example, if a checkpoint transcript said *“Implement OAuth with Google & GitHub”* but the final code only has Google, the system will catch the missing GitHub part. 

We will ingest real Entire checkpoints, use Databricks (Spark) for scalable NLP on transcripts, and integrate Entire Graph for code validation. The hackathon prototype will show: upload checkpoint JSON, AI extracts intents and tasks, Entire Graph verifies changes, and a dashboard displays “Intent → Code → Gaps” with links to the source lines.

## Using Entire CLI & Checkpoints  

Entire’s checkpoints live as separate Git refs (under `refs/entire/checkpoints/…`) that contain a `metadata.json`, session transcripts, tool logs, and subagent tasks. This data includes prompts, transcripts, files touched, and token usage. We will parse these JSON files to extract: (a) the original user/agent prompts (intent), (b) the session transcript of dialog and tool calls, and (c) the list of changed files and diffs. (Entire also annotates which agent created each line.) For implementation, we can use PyGit2 or Entire CLI commands (e.g. `entire checkpoint explain <id> --format json`) to dump the checkpoint data, and then load it into a processing pipeline.

*Key point:* every piece of evidence is traceable. For each detected task, we will output exactly which checkpoint and commit line produced it. This “provenance” ensures users can inspect the original context (file, line number, or transcript snippet) that led to each AI inference. 

## Code Intelligence via Entire Graph  

To ground AI-generated claims in actual code, we’ll use **Entire Graph** (the semantic code indexer). Entire Graph builds a local “knowledge graph” of the repo (functions, types, call graph, etc.). It provides commands like `entire graph search`, `impact`, and `diff` that answer questions about code structure. For example: 
- If the AI finds “Token expiration not tested,” we can use `entire graph search "expiration"` to locate relevant code or tests. 
- To confirm dependencies, `entire graph impact --symbol Auth.handleLogin` would list all callers and related types. 
- To review what changed in the checkpoint, `entire graph diff` highlights exactly which functions/types were added/removed and how they interrelate. 

Because Entire Graph is *100% local and deterministic*, our system can run it inside the Databricks pipeline (or via a wrapper) to automatically verify any AI summary against the real code. For instance, if the transcript mentions “auth.ts updated,” Graph can confirm which parts of `auth.ts` changed and which functions were introduced or modified. This prevents hallucination: every AI statement about code can be backed by a Graph query. 

## Databricks & Data Pipeline  

We will build the backend on a Databricks Spark cluster for scalability. All checkpoint JSON and transcripts (potentially thousands of sessions) will be ingested into Delta tables. Databricks natively supports reading JSON via Spark (e.g. `spark.read.format("json").load(...)`), so we can load each `metadata.json` and transcript file into structured Spark DataFrames. Delta Lake gives us ACID transactions and schema enforcement, crucial for enterprise data reliability. 

Once in Spark, we apply NLP models to extract intents, tasks, and missing requirements. We can use Spark NLP (John Snow Labs) for distributed text processing – it includes pretrained pipelines for named-entity recognition and sentence parsing at scale. For example, we could label any “action” entities (verbs like *implement*, *fix*, *add test* in the transcript) and correlate them with code changes. We may also fine-tune or query a Hugging Face transformer (via Spark’s Python UDFs) for tasks like summarization or intent classification. In Databricks this is feasible: we can spin up a GPU cluster to run a Hugging Face pipeline (e.g. question-answering or summarization) in parallel over many transcripts.

To manage this, we follow Databricks LLMOps best practices: keep data in the lakehouse (Delta tables), track experiments with MLflow, and use Unity Catalog for model governance. Since LLMs can hallucinate, we’ll combine ML results with rule-based extraction (e.g. look for imperative verbs, code filenames, function names in transcripts) to ensure consistency. We’ll log any assumptions and point back to the raw text. Using Delta also lets us audit and roll back if needed, aligning with the requirement for data provenance. 

## Key Features and Implementation Plan  

- **Intent Extraction:** For each checkpoint’s transcript, we run an NLP pipeline to identify the original tasks (e.g. “Add OAuth support”). We can start with a lightweight approach: simple regex or Spark NLP entity extracts verbs + objects. Optionally, use a fine-tuned LLM (Spark UDF) to rephrase the transcript into a structured “user story.” Anchor each extracted intent to the exact checkpoint and turn in the transcript.  

- **Requirement Tracking:** We compare identified intents to the list of changed files/commits. If an intent mentions a feature or file not present in the diff, we mark it as missing. E.g. transcript says “create login API,” but no `login` function was added: flag this gap. This logic is purely data-driven, using Spark joins between the “intent” table and the “code changes” table.  

- **Graph Verification:** For each extracted claim like “Token test missing,” run an Entire Graph query to see if a test symbol “test” exists for that module. If Graph finds no related call, we highlight it. Similarly, use `entire graph impact` to see if a changed function is used elsewhere; if it has zero callers but was promised as widely-used, warn the user.  

- **User Interface:** We will build a simple Next.js dashboard. It will list each checkpoint (by commit), show the original prompt and top transcript lines, and then a summary table of **Intents** vs **Status** vs **Evidence**. Each row might say: “Enable GitHub OAuth – *Not implemented* – mentioned in prompt vs no code changes in oauth.ts.” Clicking a row would reveal the transcript snippet and link to the code file and line. This direct linking (e.g. `auth.ts:45`) implements the “datapoint-level provenance” expected.  

- **Demo Scenario:** For the hack, we’ll hardcode a few sample checkpoints (JSON) to ensure reliability. Judges can see “Upload / clone repo with Entire logs → process → show timeline and handoff memo.” The Databricks part can be shown via a screenshot or explanation that the processing was done in a scalable Spark notebook. 

## Innovation and Enterprise Value  

This project goes beyond a simple chatbot: it’s an AI-powered code review & handoff assistant. By leveraging Entire’s captured sessions and Graph intelligence, it provides **actionable output** instead of generic answers. In enterprise settings with many agents, manually reviewing all AI work is impossible – our pipeline on Databricks can analyze hundreds of checkpoints daily in parallel. The use of Delta Lake and Unity Catalog means all data and models are centrally managed and governed.  

Unlike a stubby bot, Code Archaeologist ties **every insight to the actual code**. For example, if the AI notes “Forgot to add OAuth test,” we’ll cite `auth.ts:123` or the checkpoint’s prompt as evidence. We’ll also quantify uncertainty (e.g. “Confidence: low – no direct match found”). This responsible approach (traceability, highlighting assumptions) was explicitly praised in the pitch scorecard. 

In summary, our system will ingest Entire checkpoints into a Databricks Lakehouse, use Spark NLP/LLM to extract intents and tasks at scale, and harness Entire Graph’s local code map to ground all findings. The result is a dashboard and report that let any developer (or agent) instantly understand “why was this code written this way?” and “what remains to be done,” with full citations to the source data. This fits the hackathon track perfectly by making Checkpoint context an *essential input*, not just incidental output, and delivers demonstrable innovation for AI-assisted development.

**Sources:** Entire CLI docs and examples.