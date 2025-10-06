import type { ExportedHandler } from '@cloudflare/workers-types';

type Env={APP_NAME:string;PRODUCTION_ASSETS?:string;PREVIEW_ASSETS?:string;DEV_ASSETS?:string};
const pick=(host:string,env:Env)=>host.startsWith("preview.")?(env.PREVIEW_ASSETS||"https://goldshore-org-preview.pages.dev")
:host.startsWith("dev.")?(env.DEV_ASSETS||"https://goldshore-org-dev.pages.dev")
:(env.PRODUCTION_ASSETS||"https://goldshore-org.pages.dev");

export default {
  async fetch(req:Request, env:Env):Promise<Response>{
    const url=new URL(req.url), origin=pick(url.hostname,env);
    const upstream=new URL(req.url.replace(url.origin,origin));
    const res=await fetch(upstream.toString(),{method:req.method,headers:req.headers,
      body:["GET","HEAD"].includes(req.method)?undefined:await req.blob()
    });
    const h=new Headers(res.headers);
    h.set("x-served-by", env.APP_NAME);
    h.set("Cache-Control", url.pathname.match(/\.(?:js|css|png|jpg|webp|avif|svg)$/) ? "public, max-age=31536000, immutable" : "public, s-maxage=600, stale-while-revalidate=86400");
    return new Response(res.body,{status:res.status,headers:h});
  }
} satisfies ExportedHandler<Env>;
