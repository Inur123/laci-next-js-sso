"use server";
import { actionError,goAPI } from "@/lib/go-api";
export type BackupItem={key:string;filename:string;size:number;lastModified:Date};
export async function getBackupListInternal():Promise<BackupItem[]>{return getBackupList()}
export async function getBackupList():Promise<BackupItem[]>{try{return((await goAPI<any>("/backups")).data||[]).map((x:any)=>({key:x.key,filename:String(x.key).replace("backups/",""),size:x.size||0,lastModified:new Date(x.lastModified)}))}catch{return[]}}
export async function executeBackupLogic(isCron=false){void isCron;return createDatabaseBackup()}
export async function createDatabaseBackup():Promise<any>{try{const r=await goAPI<any>("/backups",{method:"POST"});return{success:r.message,filename:String(r.key).replace("backups/","")}}catch(e){return actionError(e)}}
export async function deleteDatabaseBackup(key:string):Promise<any>{try{await goAPI(`/backups?key=${encodeURIComponent(key)}`,{method:"DELETE"});return{success:"Backup database berhasil dihapus!"}}catch(e){return actionError(e)}}
export async function getBackupDownloadUrl(key:string){try{return await goAPI<any>(`/backups/url?key=${encodeURIComponent(key)}`)}catch(e){return actionError(e)}}
