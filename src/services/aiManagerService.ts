import { GoogleGenAI } from "@google/genai";
import { 
  ProductionBatch, 
  Sale, 
  Product, 
  RawMaterial, 
  Order, 
  ActivityLog,
  DailyCashReconciliation,
  RiskSnapshot
} from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ReportContext {
  date: string;
  sales: Sale[];
  batches: ProductionBatch[];
  products: Product[];
  materials: RawMaterial[];
  orders: Order[];
  logs: ActivityLog[];
  cashReconciliation?: DailyCashReconciliation;
  riskSnapshot?: RiskSnapshot;
}

const getSummaries = (context: ReportContext) => {
  const salesSummary = context.sales.reduce((acc: any, sale) => {
    sale.items.forEach(item => {
      if (!acc[item.productId]) acc[item.productId] = { qty: 0, revenue: 0 };
      acc[item.productId].qty += item.quantity;
      acc[item.productId].revenue += item.quantity * item.price;
    });
    return acc;
  }, {});

  const productionSummary = context.batches.reduce((acc: any, batch) => {
    if (!acc[batch.productId]) acc[batch.productId] = { planned: 0, actual: 0, completed: 0 };
    acc[batch.productId].planned += batch.plannedQty;
    acc[batch.productId].actual += batch.actualQty || 0;
    if (batch.status === 'completed') acc[batch.productId].completed++;
    return acc;
  }, {});

  return { salesSummary, productionSummary };
};

export const generateDailyReport = async (context: ReportContext, language: 'fr' | 'ar' = 'fr') => {
  const model = "gemini-3.1-pro-preview";
  const { salesSummary, productionSummary } = getSummaries(context);

  const prompt = `
    You are the AI Bakery Manager for "Bella Dolce", a premium bakery. 
    Your task is to analyze the daily data and provide a comprehensive, professional, and strategic report for the owner.
    
    The report should include:
    1. **Executive Summary**: A high-level overview of the day's performance.
    2. **Financial Performance**: Analysis of sales, profit (estimated), and cash reconciliation.
    3. **Production & Efficiency**: Analysis of batches completed, planned vs actual, and any production issues.
    4. **Inventory & Stock**: Alerts for low stock, waste analysis, and raw material status.
    5. **Employee & Activity**: Summary of employee work, attendance (based on logs), and notable activities.
    6. **Strategic Recommendations**: 3-5 actionable steps for tomorrow to improve profit or efficiency.
    
    Data for ${context.date}:
    - Sales: ${context.sales.length} transactions, Total Revenue: ${context.sales.reduce((acc, s) => acc + s.totalAmount, 0)} DZD.
    - Production: ${context.batches.length} batches total.
    - Orders: ${context.orders.length} orders (${context.orders.filter(o => o.status === 'delivered').length} delivered).
    - Stock Alerts: ${context.products.filter(p => p.stock < p.minStock).length} products low, ${context.materials.filter(m => m.currentStock < m.minStock).length} materials low.
    - Activity Logs: ${context.logs.length} events recorded.
    ${context.cashReconciliation ? `- Cash Reconciliation: System ${context.cashReconciliation.systemClosingBalance}, Physical ${context.cashReconciliation.physicalClosingBalance}, Discrepancy ${context.cashReconciliation.discrepancy}` : ''}
    
    Sales Summary by Product (Top Items):
    ${JSON.stringify(salesSummary, null, 2)}
    
    Production Summary by Product:
    ${JSON.stringify(productionSummary, null, 2)}
    
    Recent Activity Highlights:
    ${context.logs.slice(-10).map(l => `- ${l.timestamp}: ${l.userName} - ${l.action}: ${l.details}`).join('\n')}
    
    Please write the report in ${language === 'ar' ? 'Arabic' : 'French'}. 
    Use a professional, encouraging, yet critical tone where necessary. 
    Format the output in Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating AI report:", error);
    throw error;
  }
};

export const askAiManager = async (question: string, context: ReportContext, language: 'fr' | 'ar' = 'fr') => {
  const model = "gemini-3.1-pro-preview";
  const { salesSummary, productionSummary } = getSummaries(context);

  const prompt = `
    You are the AI Bakery Manager for "Bella Dolce", a premium bakery. 
    You have access to the bakery's data for ${context.date}.
    Your task is to answer the user's question accurately and professionally, focusing ONLY on the bakery and its operations.
    If the question is not related to the bakery, politely decline to answer.

    You can provide:
    - Detailed analysis of sales and production.
    - Inventory alerts and stock management advice.
    - Financial summaries and profit estimations.
    - Employee activity highlights.
    - Strategic recommendations for the next day.

    Bakery Data for ${context.date}:
    - Sales: ${context.sales.length} transactions, Total Revenue: ${context.sales.reduce((acc, s) => acc + s.totalAmount, 0)} DZD.
    - Production: ${context.batches.length} batches total.
    - Orders: ${context.orders.length} orders.
    - Stock Alerts: ${context.products.filter(p => p.stock < p.minStock).length} products low, ${context.materials.filter(m => m.currentStock < m.minStock).length} materials low.
    - Activity Logs: ${context.logs.length} events recorded.
    
    Sales Summary: ${JSON.stringify(salesSummary)}
    Production Summary: ${JSON.stringify(productionSummary)}
    
    User Question: "${question}"
    
    Please answer in ${language === 'ar' ? 'Arabic' : 'French'}.
    Format the output in Markdown. Use tables or lists where appropriate to make the data clear.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });
    
    return response.text;
  } catch (error) {
    console.error("Error asking AI Manager:", error);
    throw error;
  }
};
