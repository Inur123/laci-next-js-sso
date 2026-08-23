"use server";
import { actionError,formMutation,goAPI,resourceList } from "@/lib/go-api";
import { isPresensiOpen as checkOpen } from "@/lib/presensi-utils";
export async function getPresensiList(query?:string,page=1,limit=10,statusFilter?:string,sortKey?:string|null,sortDir?:"asc"|"desc"){return resourceList("/presensi",{search:query,page,limit,status:statusFilter,sortKey,sortDir})}
export async function getPresensiDetail(id:string){try{const event=(await goAPI<any>(`/public/presensi/${id}`,{public:true})).data;try{event.dataPresensi=(await goAPI<any>(`/presensi/${id}/participants`)).data||[]}catch{event.dataPresensi=[]}return event}catch{return null}}
export async function createPresensi(data:FormData){try{await formMutation("/presensi","POST",data,"documents");return{success:"Presensi berhasil dibuat"}}catch(e){return actionError(e)}}
export async function isPresensiOpen(presensi:any){return checkOpen(presensi)}
export async function updatePresensi(id:string,data:FormData){try{await formMutation(`/presensi/${id}`,"PATCH",data,"documents");return{success:"Presensi berhasil diperbarui"}}catch(e){return actionError(e)}}
export async function submitPresensiData(id:string,data:FormData){try{const body=Object.fromEntries(data.entries());await goAPI(`/public/presensi/${id}/participants`,{public:true,method:"POST",body:JSON.stringify(body)});return{success:"Presensi berhasil disimpan"}}catch(e){return actionError(e)}}
export async function deletePresensi(id:string){try{await goAPI(`/presensi/${id}`,{method:"DELETE"});return{success:"Presensi berhasil dihapus"}}catch(e){return actionError(e)}}
export async function updatePresensiStatus(id:string,mode:"AUTO"|"MANUAL_CLOSE"){try{await goAPI(`/presensi/${id}`,{method:"PATCH",body:JSON.stringify(mode==="MANUAL_CLOSE"?{isActive:false}:{isActive:true,isForcedOpen:false,forcedOpenAt:null})});return{success:"Status presensi berhasil diperbarui"}}catch(e){return actionError(e)}}
export async function getParticipantDetail(id:string){try{return(await goAPI<any>(`/presensi/participants/${id}`)).data}catch{return null}}
