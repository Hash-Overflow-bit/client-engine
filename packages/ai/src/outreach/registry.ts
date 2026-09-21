export type PortfolioProject = Readonly<{id:string;name:string;summary:string;capabilities:readonly string[];industries:readonly string[];technologies:readonly string[];proofPoints:readonly string[];enabled:boolean}>;
export type Service = Readonly<{id:string;label:string;keywords:readonly string[]}>;
export const services: readonly Service[]=[{id:'ai-saas',label:'AI SaaS product development',keywords:['ai','saas']},{id:'mvp',label:'MVP development',keywords:['mvp','product']},{id:'react-next',label:'React/Next.js frontend development',keywords:['react','next']},{id:'supabase',label:'Supabase/backend work',keywords:['supabase','backend']},{id:'ai-integrations',label:'AI integrations',keywords:['ai','integration']}];
export const portfolio: readonly PortfolioProject[]=[];
