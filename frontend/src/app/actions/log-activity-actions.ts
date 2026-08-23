"use server";
import type { LogModule } from "@prisma/client";
import { actionError,goAPI,queryString } from "@/lib/go-api";
export type LogActivityFilters={action?:string;module?:string;search?:string;dateFrom?:string;dateTo?:string;startDate?:string;endDate?:string;userId?:string;periodeId?:string;sortKey?:string;sortDir?:"asc"|"desc"};
async function logs(filters:LogActivityFilters,page:number,pageSize:number,scope?:string){try{const r=await goAPI<any>(`/activity-logs${queryString({...filters,page,limit:pageSize,scope})}`);return{data:r.data||[],total:r.pagination?.total||0,totalPages:r.pagination?.totalPages||0}}catch{return{data:[],total:0,totalPages:0}}}
export async function getPersonalLogs(filters:Omit<LogActivityFilters,"periodeId">={},page=1,pageSize=20){return logs(filters,page,pageSize)}
export async function getGlobalLogs(filters:Omit<LogActivityFilters,"periodeId">={},page=1,pageSize=20){return logs(filters,page,pageSize,"global")}
export async function getLogStats():Promise<Record<string,number>>{const r=await getPersonalLogs({},1,100);return r.data.reduce((a:Record<string,number>,x:any)=>({...a,[x.module]:(a[x.module]||0)+1}),{})}
export async function getGlobalLogStats(userId?:string):Promise<Record<string,number>|null>{void userId;const r=await getGlobalLogs({},1,100);return r.data.reduce((a:Record<string,number>,x:any)=>({...a,[x.module]:(a[x.module]||0)+1}),{})}
export async function getLogMonitoringData(userId?:string):Promise<any>{void userId;return{distribution:[],leaderboard:[],timeline:[]}}
export async function getLogActivityById(id:string):Promise<any>{try{return(await goAPI<any>(`/activity-logs/${id}`)).data}catch{return null}}
export async function logExport(module:LogModule,fileName:string){try{await goAPI("/exports/log",{method:"POST",body:JSON.stringify({module,fileName})});return{success:true}}catch(e){return actionError(e)}}
export async function logImport(module:LogModule,successCount:number,failedCount:number){try{await goAPI("/exports/log",{method:"POST",body:JSON.stringify({module,fileName:`Import ${successCount} berhasil, ${failedCount} gagal`})});return{success:true}}catch(e){return actionError(e)}}
