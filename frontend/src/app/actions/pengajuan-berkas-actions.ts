"use server";
import type { StatusPengajuan } from "@prisma/client";
import { actionError,formMutation,goAPI,resourceList } from "@/lib/go-api";
export async function getActivePacUsers(){try{return(await goAPI<any>("/users?limit=100")).data||[]}catch{return[]}}
export async function getActivePacUsersForReferensi(){return getActivePacUsers()}
export async function getPengajuanBerkass(query?:string,page=1,limit=10,statusFilter?:string,penerimaFilter?:string,sortKey?:string|null,sortDir?:"asc"|"desc"){return resourceList("/pengajuan-berkas",{search:query,page,limit,status:statusFilter,penerima:penerimaFilter,sortKey,sortDir})}
export async function getVerifikasiPengajuanForCabang(query?:string,page=1,limit=10,statusFilter?:string,penerimaFilter?:string,pacFilter?:string,sortKey?:string|null,sortDir?:"asc"|"desc"){return resourceList("/pengajuan-berkas",{scope:"review",search:query,page,limit,status:statusFilter,penerima:penerimaFilter,userId:pacFilter,sortKey,sortDir})}
export async function getPengajuanForReferensiPac(query?:string,page=1,limit=10,statusFilter?:string,penerimaFilter?:string,pacFilter?:string,sortKey?:string|null,sortDir?:"asc"|"desc"){return resourceList("/pengajuan-berkas",{scope:"reference",search:query,page,limit,status:statusFilter,penerima:penerimaFilter,userId:pacFilter,sortKey,sortDir})}
export async function getPengajuanBerkasStatsForReferensi(){try{return(await goAPI<any>("/pengajuan-berkas/stats?scope=reference")).data}catch{return{total:0,pending:0,diterima:0,ditolak:0}}}
export async function getPengajuanBerkasDetailForReferensi(id:string){return getPengajuanBerkasDetail(id)}
export async function getPengajuanBerkasById(id:string){try{return(await goAPI<any>(`/pengajuan-berkas/${id}`)).data}catch{return null}}
export async function getPengajuanBerkasDetail(id:string){return getPengajuanBerkasById(id)}
export async function createPengajuanBerkas(data:FormData){try{await formMutation("/pengajuan-berkas","POST",data,"pengajuan");return{success:"Pengajuan berkas berhasil dikirim!"}}catch(e){return actionError(e)}}
export async function updatePengajuanBerkas(id:string,data:FormData){try{await formMutation(`/pengajuan-berkas/${id}`,"PATCH",data,"pengajuan");return{success:"Pengajuan berkas berhasil diperbarui!"}}catch(e){return actionError(e)}}
export async function deletePengajuanBerkas(id:string){try{await goAPI(`/pengajuan-berkas/${id}`,{method:"DELETE"});return{success:"Pengajuan berkas berhasil dihapus!"}}catch(e){return actionError(e)}}
export async function updateStatusPengajuan(id:string,status:StatusPengajuan,alasanPenolakan?:string){try{await goAPI(`/pengajuan-berkas/${id}/status`,{method:"PATCH",body:JSON.stringify({status,reason:alasanPenolakan})});return{success:"Status pengajuan berhasil diperbarui!"}}catch(e){return actionError(e)}}
export async function getPengajuanBerkasStats(userId?:string){try{return(await goAPI<any>(`/pengajuan-berkas/stats${userId?`?userId=${encodeURIComponent(userId)}`:""}`)).data}catch{return{total:0,pending:0,diterima:0,ditolak:0}}}
export async function downloadPengajuanFile(id:string){return Buffer.from(await goAPI<ArrayBuffer>(`/pengajuan-berkas/${id}/download`))}
export async function getPengajuanDownloadToken(id:string){return goAPI<any>(`/pengajuan-berkas/${id}/download-token`,{method:"POST"})}
