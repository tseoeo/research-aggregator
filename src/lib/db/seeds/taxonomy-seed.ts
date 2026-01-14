/**
 * Taxonomy Seed Data
 *
 * Initial use-case taxonomy entries for DTL-P analysis.
 * Run with: npx tsx src/lib/db/seeds/taxonomy-seed.ts
 */

import "dotenv/config";
import { db } from "../index";
import { taxonomyEntries } from "../schema";

const INITIAL_TAXONOMY: Array<{
  name: string;
  definition: string;
  inclusions: string[];
  exclusions: string[];
  examples: string[];
  synonyms: string[];
}> = [
  {
    name: "Customer support and service automation",
    definition:
      "AI systems that handle customer inquiries, resolve issues, or augment human support agents through chatbots, ticket routing, sentiment analysis, or automated responses.",
    inclusions: [
      "Chatbots and virtual assistants for customer service",
      "Ticket classification and routing",
      "Sentiment analysis for support",
      "Automated FAQ and knowledge base systems",
      "Voice assistants for call centers",
    ],
    exclusions: [
      "Internal IT helpdesk (see Engineering productivity)",
      "Sales chatbots focused on lead generation (see Marketing)",
    ],
    examples: [
      "GPT-powered chatbot reducing ticket volume by 40%",
      "Sentiment classifier prioritizing urgent support cases",
      "Voice AI handling routine call center inquiries",
    ],
    synonyms: ["Customer service AI", "Support automation", "Conversational support"],
  },
  {
    name: "Enterprise search and retrieval",
    definition:
      "AI systems that enable searching, retrieving, and synthesizing information from large document collections, knowledge bases, or unstructured enterprise data.",
    inclusions: [
      "Semantic search over documents",
      "RAG (Retrieval-Augmented Generation) systems",
      "Knowledge base Q&A",
      "Document similarity and clustering",
      "Enterprise knowledge graphs",
    ],
    exclusions: [
      "Web search engines (consumer-facing)",
      "E-commerce product search (see Personalization)",
    ],
    examples: [
      "Legal document search with semantic understanding",
      "Internal wiki Q&A system for employees",
      "RAG system for policy document retrieval",
    ],
    synonyms: ["Document search", "Knowledge retrieval", "Enterprise RAG", "Semantic search"],
  },
  {
    name: "Personalization and recommendations",
    definition:
      "AI systems that tailor content, products, or experiences to individual users based on their behavior, preferences, or context.",
    inclusions: [
      "Product recommendations",
      "Content personalization",
      "Dynamic pricing based on user segments",
      "Personalized email/notification content",
      "User preference learning",
    ],
    exclusions: [
      "A/B testing frameworks (infrastructure)",
      "Generic segmentation without AI",
    ],
    examples: [
      "E-commerce recommendation engine increasing conversion 15%",
      "News feed personalization based on reading history",
      "Personalized learning paths in education platforms",
    ],
    synonyms: ["Recommendation systems", "User personalization", "Adaptive experiences"],
  },
  {
    name: "Marketing content and lifecycle automation",
    definition:
      "AI systems that generate, optimize, or automate marketing content and customer lifecycle communications including ads, emails, social posts, and campaign optimization.",
    inclusions: [
      "AI-generated marketing copy",
      "Email campaign optimization",
      "Ad creative generation",
      "Social media content automation",
      "Lead scoring and nurturing",
      "Customer journey orchestration",
    ],
    exclusions: [
      "Generic content generation not for marketing",
      "Customer support (see Customer support)",
    ],
    examples: [
      "GPT-powered email subject line optimization",
      "Automated social media post generation",
      "AI lead scoring improving sales conversion",
    ],
    synonyms: ["Marketing AI", "Content automation", "Campaign optimization"],
  },
  {
    name: "Document processing (contracts, invoices, compliance)",
    definition:
      "AI systems that extract, classify, validate, or transform information from structured and unstructured documents for business processes.",
    inclusions: [
      "Invoice data extraction",
      "Contract analysis and clause detection",
      "Compliance document review",
      "Form processing and OCR",
      "Document classification",
      "Regulatory filing automation",
    ],
    exclusions: [
      "General document search (see Enterprise search)",
      "Document generation (see Marketing or Engineering)",
    ],
    examples: [
      "Invoice processing reducing manual entry by 80%",
      "Contract clause extraction for legal review",
      "Automated compliance checking for regulatory filings",
    ],
    synonyms: ["IDP", "Intelligent Document Processing", "Document automation"],
  },
  {
    name: "Analytics and forecasting",
    definition:
      "AI systems that analyze historical data to generate insights, predictions, or forecasts for business decision-making.",
    inclusions: [
      "Demand forecasting",
      "Sales prediction",
      "Churn prediction",
      "Financial forecasting",
      "Trend analysis",
      "Anomaly detection for business metrics",
    ],
    exclusions: [
      "Real-time fraud detection (see Fraud and risk)",
      "Infrastructure monitoring (see Engineering)",
    ],
    examples: [
      "Demand forecasting reducing inventory costs 20%",
      "Churn prediction enabling proactive retention",
      "Sales forecasting improving quarterly planning",
    ],
    synonyms: ["Predictive analytics", "Business intelligence AI", "Forecasting"],
  },
  {
    name: "Fraud, risk, and anomaly detection",
    definition:
      "AI systems that identify fraudulent activities, assess risk, or detect anomalies in transactions, behaviors, or systems for security and compliance.",
    inclusions: [
      "Transaction fraud detection",
      "Credit risk assessment",
      "AML (Anti-Money Laundering)",
      "Insurance claim fraud",
      "Cybersecurity threat detection",
      "Behavioral anomaly detection",
    ],
    exclusions: [
      "Business metric anomalies (see Analytics)",
      "Infrastructure monitoring without security focus",
    ],
    examples: [
      "Real-time payment fraud detection with 99.5% precision",
      "Credit scoring model reducing default rates",
      "Anomaly detection catching insider threats",
    ],
    synonyms: ["Fraud detection", "Risk AI", "Security analytics"],
  },
  {
    name: "Engineering productivity (coding, testing)",
    definition:
      "AI systems that augment software development, testing, debugging, code review, or developer workflows.",
    inclusions: [
      "Code generation and completion",
      "Automated testing and test generation",
      "Code review automation",
      "Bug detection and fixing",
      "Documentation generation",
      "DevOps automation",
    ],
    exclusions: [
      "No-code platforms without AI",
      "Project management tools",
    ],
    examples: [
      "Copilot-style code completion reducing dev time 30%",
      "Automated unit test generation",
      "AI-powered code review catching bugs pre-merge",
    ],
    synonyms: ["Developer AI", "Code AI", "DevOps AI", "Software engineering AI"],
  },
  {
    name: "Agentic workflows (multi-step automation)",
    definition:
      "AI systems that autonomously execute multi-step tasks, make decisions, use tools, and coordinate complex workflows with minimal human intervention.",
    inclusions: [
      "Autonomous agents for business processes",
      "Multi-step task automation",
      "Tool-using AI agents",
      "Workflow orchestration with AI decision-making",
      "RPA enhanced with LLM reasoning",
    ],
    exclusions: [
      "Simple single-turn chatbots",
      "Rule-based automation without AI reasoning",
    ],
    examples: [
      "AI agent handling end-to-end expense reporting",
      "Autonomous research agent gathering and synthesizing data",
      "Multi-tool agent automating sales operations",
    ],
    synonyms: ["AI agents", "Autonomous AI", "Agentic AI", "Multi-step AI"],
  },
];

async function seed() {
  console.log("Seeding taxonomy entries...");

  for (const entry of INITIAL_TAXONOMY) {
    try {
      await db
        .insert(taxonomyEntries)
        .values({
          type: "use_case",
          name: entry.name,
          definition: entry.definition,
          inclusions: entry.inclusions,
          exclusions: entry.exclusions,
          examples: entry.examples,
          synonyms: entry.synonyms,
          status: "active",
          usageCount: 0,
          version: 1,
        })
        .onConflictDoNothing();

      console.log(`  ✓ ${entry.name}`);
    } catch (error) {
      console.error(`  ✗ ${entry.name}:`, error);
    }
  }

  console.log("\nTaxonomy seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
