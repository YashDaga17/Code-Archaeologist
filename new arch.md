# Architecture Overview  
Our solution is built as a **Databricks-hosted full-stack app**. A React/Next.js frontend runs as a Databricks App (serverless Node.js), and queries data from a Delta Lake via Databricks SQL.  The Next.js backend also calls the Databricks **Foundation Model APIs** (OpenAI-compatible LLM endpoints) to analyze checkpoint transcripts.  In parallel, a separate Databricks cluster (with custom Docker) runs the Entire CLI/Graph tools to parse the code repository. All structured data (checkpoints, extracted tasks, verification results) are written into Delta tables.  This design leverages Databricks Apps’ native integration with Databricks SQL, Unity Catalog, and Model Serving.  

 *Figure: Databricks Apps architecture for Code Archaeologist. The Next.js frontend invokes Databricks SQL (Delta tables) and Foundation Model endpoints for NLP, while a separate cluster runs Entire CLI/Graph. Databricks Apps natively integrate with Databricks SQL and Model Serving.*  

# Ingesting Entire Checkpoints  
We mirror the developer’s Git repo into Databricks (for example via a Unity Catalog volume or periodic Git sync). A Databricks Job periodically runs on a compute cluster to scan the `.entire/checkpoints` files. Each checkpoint JSON contains the session **prompt, transcript, agent commands, and changed files**.  We parse out key fields (e.g. list of claimed tasks from the transcript, file diffs) and insert them into a Delta Lake table.  Delta Lake is the native ACID storage on Databricks, guaranteeing consistency and scalable metadata. Storing checkpoint context in Delta means **no data is lost on container restarts**, and we can query large volumes efficiently using Databricks SQL.

# Databricks Environment Setup (CLI & Graph)  
To run Entire CLI/Graph, we use a Databricks compute cluster with **Container Services** enabled. We can build a custom Docker image (or init-script) that has `entire` and `entire-graph` preinstalled.  Databricks will pull this image and spin up worker nodes inside it.  For example, a Databricks CLI command can specify `"docker_image": {"url": "databricksruntime/standard:latest"}` when creating the cluster (with Entire added via the Dockerfile or init-script).  The process is: Databricks downloads our Docker image, creates a container, and installs the Databricks runtime on top. This cluster runs our background jobs: it clones the repo, runs `entire checkpoint list`, `entire graph ...` commands, and writes results to Delta.  

# NLP Pipeline with Foundation Models  
Checkpoint transcripts are generally long and unstructured. We use Databricks’ **Foundation Model APIs** (LLMs) to extract tasks and verify descriptions. For example, we can call an open-source LLM (e.g. Llama 3 via Databricks) using the OpenAI-compatible API. Databricks explicitly supports this: “The APIs are compatible with OpenAI, so you can use the OpenAI client for querying”. In practice, our Next.js backend makes REST calls to `api.cloud.databricks.com/llm` (via the official SDK) with `service_tier="priority"` for low-latency inference.  A sample prompt might be: *“List the explicit requirements or tasks described in this transcript.”* and the LLM returns a checklist of tasks. By using the **priority pay-per-token mode**, we ensure the live demo has consistently low latency.  

After extracting tasks in natural language, we parse them into structured form. For example, if the transcript mentions “forgot to add encryption to the login API”, we record `requirement: "Add encryption"` and note it as **unfinished** if not found in the code.  

# Graph Verification with Entire-Graph  
Once we have a set of claimed features or requirements from NLP, we **verify against the code** using Entire Graph’s static analysis. Entire Graph builds a semantic map of the repo: it indexes definitions, callers, type information, and change-impact links. Importantly, it runs *locally* with Tree-sitter and needs no LLM or network calls. For each claimed task (e.g. “token expiration handling is missing”), we can query the graph: e.g., list all functions related to token expiration, or check if there are any tests for it. If the graph finds **no evidence** of a promised feature (or finds contradictions), we flag it. For instance, if NLP says “remote login was promised” but Entire Graph finds no code about remote login, the UI will highlight that gap. Entire Graph even provides file:line citations, so our app can show exactly **where** (and whether) the code meets the requirement. This deterministic verification grounds every LLM claim in real source code.  

# Asynchronous UI Pattern  
Many tasks (LLM inference, graph queries) take longer than 30 seconds. Databricks Apps enforces a ~30s ingress timeout, so we **cannot block** a web request for that long. Instead, we implement the standard “status-polling” pattern: 
1. The Next.js API (e.g. `/api/validate`) immediately starts the analysis job and returns HTTP 202 with a `task_id`.  
2. We store `task_id` and its state in a lightweight table (or Delta table) on the cluster.  
3. The frontend then periodically calls a status endpoint `/api/status/{task_id}` until it sees “complete” or an error.  
This avoids any request hanging. The Databricks documentation explicitly notes: “The polling pattern is the standard recommendation” for long workloads. (SSE/websockets could be used, but polling is simpler and guaranteed not to hit the gateway timeout.) Using a Delta table (rather than in-memory) to track results ensures that even if the app container restarts, the task history survives.  

# Databricks SQL and Next.js Integration  
Our Next.js app connects to Databricks SQL to display results. We use the official **@databricks/sql** Node.js driver in the backend. This library lets JavaScript run SQL commands on Databricks compute. The driver uses environment variables (`DATABRICKS_SERVER_HOSTNAME`, etc.) to securely connect. Through it, our app can query the Delta tables of checkpoints and analysis results. Databricks Apps natively support this integration: “Databricks Apps natively integrate with Databricks SQL: for querying large datasets efficiently”. Unity Catalog manages access control on these tables. We typically fetch only the needed chunks of data (e.g. the summary report and cited lines), rather than streaming entire transcripts into the browser.  

# Demonstration Plan and Metrics  
For the demo, we’ll create a realistic “code archaeology” scenario. For example, imagine a developer used an AI agent to implement authentication (promising “email+GitHub OAuth, token expiration test”, etc.). After the checkpoint is created, our UI shows:  
- **Original intent and tasks** (from NLP).  
- **Completed vs. missing** features (from graph verification).  
- For each item, links to the relevant code (file:line) or a notice “no evidence found”.  
We’ll show the async status updates: the UI might display “Analyzing…” with a spinner, then populate the checklist when done.  

**Metrics:** We can log and report how many tasks were identified vs. how many were found in code, or how many contradictions were detected. Databricks Apps allow capturing telemetry (via OpenTelemetry env variables) to measure response times and model usage. Because we ground every LLM statement in code citations, the result is a high-confidence report that developers can trust.  

Overall, this architecture addresses all scoring criteria: it uses real Entire checkpoint context and Graph analysis; it uses Databricks Foundation Models and Apps as required; it handles scale and asynchronous workflows robustly. The end product will be an innovative “developer handoff assistant” that makes AI-assisted coding *safer and verifiable*. 

**References:** Official Databricks and Entire documentation and community articles, including design patterns for Databricks Apps and example code..