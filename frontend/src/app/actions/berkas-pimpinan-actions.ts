"use server";
import { actionError,formMutation,goAPI,resourceList } from "@/lib/go-api";
export async function getBerkasPimpinans(query?:string,page=1,limit=10,sortKey?:string|null,sortDir?:"asc"|"desc"){return resourceList("/berkas-pimpinan",{search:query,page,limit,sortKey,sortDir})}
export async function getBerkasPimpinanById(id:string){try{return(await goAPI<any>(`/berkas-pimpinan/${id}`)).data}catch{return null}}
export async function createBerkasPimpinan(data:FormData){try{await formMutation("/berkas-pimpinan","POST",data,"berkas-pimpinan");return{success:"Berkas berhasil ditambahkan!"}}catch(e){return actionError(e)}}
export async function updateBerkasPimpinan(id:string,data:FormData){try{await formMutation(`/berkas-pimpinan/${id}`,"PATCH",data,"berkas-pimpinan");return{success:"Berkas berhasil diperbarui!"}}catch(e){return actionError(e)}}
export async function deleteBerkasPimpinan(id:string){try{await goAPI(`/berkas-pimpinan/${id}`,{method:"DELETE"});return{success:"Berkas berhasil dihapus!"}}catch(e){return actionError(e)}}
export async function downloadBerkasPimpinanFile(id:string){return Buffer.from(await goAPI<ArrayBuffer>(`/berkas-pimpinan/${id}/download`))}
export async function bulkImportBerkasPimpinan(rows:Array<Record<string,any>>):Promise<any>{try{const r=await goAPI<any>("/imports/berkas-pimpinan",{method:"POST",body:JSON.stringify({rows})});return{...r,failedRows:r.errors||[]}}catch(e){return actionError(e)}}
export async function getBerkasPimpinanStats(){try{return(await goAPI<any>("/berkas-pimpinan/stats")).data}catch{return{total:0}}}
export async function getBerkasPimpinanDownloadToken(id:string){return goAPI<any>(`/berkas-pimpinan/${id}/download-token`,{method:"POST"})}
