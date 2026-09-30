/**
 * Skill vocabulary used to compare a resume with a posting. Each entry is the
 * label we show plus the patterns that count as a mention. Patterns are
 * matched case-insensitively on word boundaries.
 */
type SkillDef = { label: string; patterns: RegExp[] };

function words(...terms: string[]): RegExp[] {
  return terms.map(
    (term) =>
      new RegExp(
        `(?<![\\w+#.])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s-]?")}(?![\\w+#])`,
        "i"
      )
  );
}

const SKILLS: SkillDef[] = [
  // Languages
  { label: "Python", patterns: words("python") },
  { label: "TypeScript", patterns: words("typescript") },
  { label: "JavaScript", patterns: words("javascript", "node.js", "nodejs") },
  { label: "Java", patterns: words("java") },
  // Capital "Go" mid-sentence ("Python and Go", "in Go,") — not "Go beyond" at a sentence start.
  { label: "Go", patterns: [/\bgolang\b/i, /(?:(?<=[a-z,;/(]\s{1,2})|(?<=[,/(]))Go\b(?![-'’])/] },
  { label: "Rust", patterns: words("rust") },
  { label: "C++", patterns: [/(?<![\w])c\+\+/i, /\bcpp\b/i] },
  { label: "C#", patterns: [/(?<![\w])c#/i, /\.net\b/i] },
  { label: "Swift", patterns: words("swift") },
  { label: "Kotlin", patterns: words("kotlin") },
  { label: "Scala", patterns: words("scala") },
  { label: "Ruby", patterns: words("ruby", "rails") },
  { label: "SQL", patterns: words("sql", "postgres", "postgresql", "mysql") },
  { label: "Bash", patterns: words("bash", "shell scripting") },
  // Web
  { label: "React", patterns: words("react", "react.js", "reactjs") },
  { label: "Next.js", patterns: words("next.js", "nextjs") },
  { label: "REST APIs", patterns: words("restful", "rest api", "rest apis", "rest services") },
  { label: "GraphQL", patterns: words("graphql") },
  { label: "FastAPI", patterns: words("fastapi") },
  { label: "HTML/CSS", patterns: words("html", "css") },
  // Cloud & infra
  { label: "AWS", patterns: words("aws", "amazon web services", "ec2", "s3", "eks", "lambda") },
  { label: "GCP", patterns: words("gcp", "google cloud") },
  { label: "Azure", patterns: words("azure") },
  { label: "Docker", patterns: words("docker", "containers", "containerization") },
  { label: "Kubernetes", patterns: words("kubernetes", "k8s", "eks", "gke") },
  { label: "Terraform", patterns: words("terraform", "infrastructure as code", "iac") },
  { label: "CI/CD", patterns: [/\bci\s*\/\s*cd\b/i, /\bgithub actions\b/i, /\bcontinuous (?:integration|deployment)\b/i] },
  { label: "Linux", patterns: words("linux", "unix") },
  { label: "Distributed systems", patterns: words("distributed systems", "distributed system") },
  { label: "Observability", patterns: words("observability", "prometheus", "grafana", "monitoring") },
  { label: "Kafka", patterns: words("kafka") },
  { label: "Spark", patterns: words("spark", "pyspark") },
  { label: "Databases", patterns: words("database", "databases", "postgres", "mongodb", "redis", "dynamodb") },
  // ML / AI
  { label: "Machine learning", patterns: words("machine learning", "ml") },
  { label: "PyTorch", patterns: words("pytorch", "torch") },
  { label: "TensorFlow", patterns: words("tensorflow", "keras") },
  { label: "scikit-learn", patterns: words("scikit-learn", "sklearn") },
  { label: "LLMs", patterns: words("llm", "llms", "large language model", "large language models", "gpt", "claude", "foundation models") },
  { label: "LLM evaluation", patterns: words("evals", "llm evaluation", "model evaluation", "evaluation harness", "evaluation harnesses") },
  { label: "AI agents", patterns: words("agentic", "multi-agent", "ai agents", "llm agents", "agent frameworks", "agent systems") },
  { label: "MCP", patterns: words("mcp", "model context protocol") },
  { label: "RAG", patterns: words("rag", "retrieval augmented generation", "retrieval-augmented generation", "vector database", "embeddings") },
  { label: "Prompt engineering", patterns: words("prompt engineering", "prompting") },
  { label: "Data pipelines", patterns: words("data pipelines", "data pipeline", "etl") },
  { label: "pandas/NumPy", patterns: words("pandas", "numpy") },
  { label: "Computer vision", patterns: words("computer vision", "cnn", "image classification") },
  { label: "Anomaly detection", patterns: words("anomaly detection") },
  // Practices
  { label: "Testing", patterns: words("unit tests", "testing", "pytest", "test automation") },
  { label: "System design", patterns: words("system design", "systems design") },
  { label: "Mobile", patterns: words("ios", "android", "mobile") },
  { label: "Customer-facing", patterns: words("customer-facing", "customer facing", "client-facing", "work directly with customers", "stakeholders") },
  { label: "Leadership", patterns: words("led a team", "team lead", "mentored", "mentoring", "leadership") },
];

export function extractSkills(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const skill of SKILLS) {
    if (skill.patterns.some((pattern) => pattern.test(text))) {
      found.push(skill.label);
    }
  }
  return found;
}

export type SkillMatch = {
  matched: string[];
  missing: string[];
  /** Share of the posting's skills that also show up on the resume (0–1); null when the posting names too few to judge */
  coverage: number | null;
};

export function matchSkills(resumeText: string, postingText: string): SkillMatch {
  const resume = new Set(extractSkills(resumeText));
  const posting = extractSkills(postingText);
  const matched = posting.filter((skill) => resume.has(skill));
  const missing = posting.filter((skill) => !resume.has(skill));
  return {
    matched,
    missing,
    coverage: posting.length >= 3 ? matched.length / posting.length : null,
  };
}
