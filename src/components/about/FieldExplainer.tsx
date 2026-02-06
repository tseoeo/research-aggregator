const glanceFields = [
  {
    num: 1,
    name: "Hook Sentence",
    what: "A single sentence summarizing what the paper does and why it matters \u2014 in practical terms, not academic ones.",
    why: "Tells you in 5 seconds whether this paper is relevant to you.",
  },
  {
    num: 2,
    name: "What Kind",
    what: "The type of contribution \u2014 New Method, New Model, Benchmark, Dataset, Infrastructure, Application, Survey, or Safety / Alignment.",
    why: "Different types are useful for different reasons. A new method is different from a survey.",
    badge: "blue",
  },
  {
    num: 3,
    name: "Impact Area Tags",
    what: "1\u20133 tags describing which areas of AI this paper affects \u2014 like Cost & Efficiency, Tool Use & Agents, or Multimodal.",
    why: "Lets you quickly filter for the areas you care about.",
  },
  {
    num: 4,
    name: "Practical Value Score",
    what: "A score from 0\u20136 based on three questions: Does it solve a real problem? Does it show concrete results? Could you actually use it?",
    why: "Cuts through hype. A paper can be impressive research but score low if it\u2019s not practically useful yet.",
  },
  {
    num: 5,
    name: "Time-to-Value",
    what: "How soon this could be practically useful \u2014 Now, Soon, or Later.",
    why: "Separates \u201Cuse this today\u201D from \u201Cinteresting but years away.\u201D",
  },
  {
    num: 6,
    name: "Readiness Level",
    what: "How much work it would take to use this \u2014 Ready to Try, Needs Engineering, or Research Only.",
    why: "Tells you the gap between \u201Cpublished\u201D and \u201Cusable.\u201D",
  },
];

const drawerFields = [
  {
    num: 7,
    name: "Key Numbers",
    what: "The 1\u20133 most important quantitative results from the paper, with context about what they\u2019re compared to.",
    why: "Numbers with context tell you if the improvement is meaningful or marginal.",
  },
  {
    num: 8,
    name: "How This Changes Things",
    what: "2\u20133 concrete examples of how this research could affect real users, businesses, or products.",
    why: "Bridges the gap between \u201Cwhat the paper says\u201D and \u201Cwhy anyone outside academia should care.\u201D",
  },
  {
    num: 9,
    name: "What Came Before",
    what: "One line of context about what existed before this paper \u2014 the prior state of the art.",
    why: "You can\u2019t evaluate a step forward without knowing where you started.",
  },
  {
    num: 10,
    name: "Who\u2019s Behind This",
    what: "The institution or lab behind the paper and the team size \u2014 pulled from paper metadata, not AI-generated.",
    why: "Context about who did the work. A paper from a major lab carries different weight than a solo submission.",
  },
];

function FieldItem({ num, name, what, why }: { num: number; name: string; what: string; why: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs font-bold text-primary mt-0.5 shrink-0 w-5 text-right">{num}.</span>
      <div>
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{what}</p>
        <p className="text-sm text-muted-foreground/80 mt-0.5 leading-relaxed italic">{why}</p>
      </div>
    </div>
  );
}

export function FieldExplainer() {
  return (
    <div className="space-y-8">
      {/* At a Glance */}
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
          What You See at a Glance
        </h3>
        <div className="space-y-5">
          {glanceFields.map((f) => (
            <FieldItem key={f.num} {...f} />
          ))}
        </div>
      </div>

      {/* When You Open */}
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
          What You See When You Open a Paper
        </h3>
        <div className="space-y-5">
          {drawerFields.map((f) => (
            <FieldItem key={f.num} {...f} />
          ))}
        </div>
      </div>
    </div>
  );
}
