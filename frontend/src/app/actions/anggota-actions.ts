"use server";
import { actionError,goAPI,resourceList } from "@/lib/go-api";
export async function getAnggotaList(query?:string,page=1,limit=10,userId?:string,periodeId?:string,sortKey?:string|null,sortDir?:"asc"|"desc",status?:"PENDING"|"DITERIMA"|"DITOLAK"){return resourceList("/anggota",{search:query,page,limit,userId,periodeId,sortKey,sortDir,status})}
export async function getActiveUsers(){try{return(await goAPI<any>("/users?limit=100")).data||[]}catch{return[]}}
export async function getAnggotaById(id:string){try{return(await goAPI<any>(`/anggota/${id}`)).data}catch{return null}}
export async function deleteAnggota(id:string){try{await goAPI(`/anggota/${id}`,{method:"DELETE"});return{success:"Data anggota berhasil dihapus!"}}catch(e){return actionError(e)}}
export async function verifikasiAnggota(id:string,status:"DITERIMA"|"DITOLAK",alasanPenolakan?:string){try{await goAPI(`/anggota/${id}/status`,{method:"PATCH",body:JSON.stringify({status,reason:alasanPenolakan})});return{success:"Status anggota berhasil diperbarui!"}}catch(e){return actionError(e)}}
export async function getAnggotaStats(userId?:string){try{return(await goAPI<any>(`/anggota/stats${userId?`?userId=${encodeURIComponent(userId)}`:""}`)).data}catch{return{total:0,lakiLaki:0,perempuan:0,makesta:0,lakmud:0,latin:0,latpel:0,lakut:0}}}
