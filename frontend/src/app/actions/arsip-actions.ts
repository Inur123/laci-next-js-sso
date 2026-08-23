"use server";
import { actionError,formMutation,goAPI,resourceList } from "@/lib/go-api";
export async function getArsipSurats(query?:string,organisasiFilter?:string,jenisSuratFilter?:string,page=1,limit=10,sortKey?:string|null,sortDir?:"asc"|"desc"){return resourceList("/arsip",{search:query,organisasi:organisasiFilter,jenisSurat:jenisSuratFilter,page,limit,sortKey,sortDir})}
export async function getArsipStats(){try{return(await goAPI<any>("/arsip/stats")).data}catch{return{total:0,masuk:0,keluar:0}}}
export async function getArsipSuratById(id:string){try{return(await goAPI<any>(`/arsip/${id}`)).data}catch{return null}}
export async function createArsipSurat(data:FormData){try{await formMutation("/arsip","POST",data,"arsip");return{success:"Arsip surat berhasil ditambahkan!"}}catch(e){return actionError(e)}}
export async function updateArsipSurat(id:string,data:FormData){try{await formMutation(`/arsip/${id}`,"PATCH",data,"arsip");return{success:"Arsip surat berhasil diperbarui!"}}catch(e){return actionError(e)}}
export async function deleteArsipSurat(id:string){try{await goAPI(`/arsip/${id}`,{method:"DELETE"});return{success:"Arsip surat berhasil dihapus!"}}catch(e){return actionError(e)}}
export async function downloadArsipFile(id:string){return Buffer.from(await goAPI<ArrayBuffer>(`/arsip/${id}/download`))}
export async function bulkImportArsipSurat(rows:Array<Record<string,any>>):Promise<any>{try{const r=await goAPI<any>("/imports/arsip",{method:"POST",body:JSON.stringify({rows})});return{...r,failedRows:r.errors||[]}}catch(e){return actionError(e)}}
export async function getArsipDownloadToken(id:string){return goAPI<any>(`/arsip/${id}/download-token`,{method:"POST"})}
