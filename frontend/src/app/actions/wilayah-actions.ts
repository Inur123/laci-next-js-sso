"use server";
import type { JenisWilayah } from "@prisma/client";
import { actionError,formMutation,goAPI,resourceList } from "@/lib/go-api";
export async function getWilayahList(jenis:JenisWilayah,query?:string,page=1,limit=10,userIdFilter?:string,periodeId?:string,sortKey?:string|null,sortDir?:"asc"|"desc"){return resourceList("/wilayah",{jenis,search:query,page,limit,userId:userIdFilter,periodeId,sortKey,sortDir})}
export async function createWilayah(data:FormData){try{await formMutation("/wilayah","POST",data,"documents");return{success:"Wilayah berhasil ditambahkan"}}catch(e){return actionError(e)}}
export async function updateWilayah(id:string,data:FormData){try{await formMutation(`/wilayah/${id}`,"PATCH",data,"documents");return{success:"Wilayah berhasil diperbarui"}}catch(e){return actionError(e)}}
export async function deleteWilayah(id:string){try{await goAPI(`/wilayah/${id}`,{method:"DELETE"});return{success:"Wilayah berhasil dihapus"}}catch(e){return actionError(e)}}
export async function copyWilayahToCurrentPeriode(wilayahIds:string[],jenis:JenisWilayah){try{const r=await goAPI<any>("/wilayah/copy",{method:"POST",body:JSON.stringify({wilayahIds,jenis})});return{success:r.message,copied:r.copied}}catch(e){return actionError(e)}}
