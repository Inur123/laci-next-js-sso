"use client";

import React from "react";
import {
  Home,
  Calendar,
  LogOut,
  User as UserIcon,
  ChevronsUpDown,
  Users,
  Archive,
  ChevronDown,
  FileText,
  CalendarDays,
  History,
  Bug,
  QrCode,
  Mail,
  Database,
} from "lucide-react";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/lib/auth-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Interface eksplisit untuk Better Auth User agar Linter tidak merah
interface BetterUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  role: string | "SEKRETARIS_CABANG" | "SEKRETARIS_PAC";
  emailVerified: boolean | null;
  isActive: boolean;
  periodeAktifId?: string | null;
}

const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Pengajuan Berkas",
    url: "/dashboard/pengajuan-berkas",
    icon: FileText,
  },
  {
    title: "Data Anggota",
    url: "/dashboard/anggota",
    icon: Users,
  },
  {
    title: "Periode",
    url: "/dashboard/periode",
    icon: Calendar,
  },
];

const getUserImageUrl = (user: BetterUser) => {
  if (!user.image) return "";
  if (user.image.startsWith("http")) return user.image;
  return `/api/manajemen-user/${user.id}/image?v=${user.image}`;
};

export function AppSidebar({
  user,
  themeClass,
}: {
  user: BetterUser;
  themeClass?: string;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }
  };

  const handleLogout = async () => {
    handleMenuClick();
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/login?logout=success");
        },
      },
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Create dynamic menu structure
  const menuItems = [];

  // 1. Dashboard (Always Visible)
  menuItems.push(items.find((i) => i.title === "Dashboard")!);

  // Only show other menus if email is verified
  if (user.emailVerified) {
    const pengajuanItem = items.find((i) => i.title === "Pengajuan Berkas")!;
    menuItems.push({
      ...pengajuanItem,
      url: "/dashboard/pengajuan-berkas",
      title: "Pengajuan Berkas",
    });

    if (user.role === "SEKRETARIS_PAC") {
      menuItems.push({
        title: "Referensi Pengajuan",
        url: "/dashboard/referensi-pengajuan",
        icon: FileText,
      });
    }

    menuItems.push(items.find((i) => i.title === "Data Anggota")!);

    if (user.role === "SEKRETARIS_CABANG") {
      menuItems.push({
        title: "Agenda Kegiatan",
        url: "/dashboard/agenda-kegiatan",
        icon: CalendarDays,
      });
    }

    menuItems.push({
      title: "Presensi",
      url: "/dashboard/presensi",
      icon: QrCode,
    });

    if (user.role === "SEKRETARIS_CABANG") {
      menuItems.push({
        title: "Manajemen User",
        url: "/dashboard/manajemen-user",
        icon: Users,
      });
    }

    menuItems.push(items.find((i) => i.title === "Periode")!);

    menuItems.push({
      title: "Riwayat Aktivitas",
      url: "/dashboard/log-activity",
      icon: History,
    });

    if (user.role === "SEKRETARIS_CABANG") {
      menuItems.push({
        title: "Log Email",
        url: "/dashboard/log-email",
        icon: Mail,
      });
      menuItems.push({
        title: "Backup Database",
        url: "/dashboard/backup",
        icon: Database,
      });
    }
  }

  return (
    <Sidebar className={themeClass}>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0">
            <Image
              src="/images/logo-laci.webp"
              alt="Logo Laci"
              fill
              sizes="40px"
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-bold text-lg">
              {user.role === "SEKRETARIS_CABANG" ? "Laci Cabang" : "Laci PAC"}
            </span>
            <Badge
              variant="outline"
              className="w-fit text-[10px] bg-white text-primary border-primary/20 hover:bg-slate-50 transition-colors shadow-none"
            >
              {user.role === "SEKRETARIS_CABANG" ? "CABANG" : "PAC"}
            </Badge>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Aplikasi</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => {
                const isActive =
                  item.url === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.url);

                return (
                  <React.Fragment key={item.title}>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={isActive ? "sidebar-item-active" : ""}
                      >
                        <Link href={item.url} onClick={handleMenuClick}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {index === 0 && user.emailVerified && (
                      <Collapsible
                        asChild
                        defaultOpen={
                          pathname.startsWith("/dashboard/arsip") ||
                          pathname.startsWith("/dashboard/berkas-sp") ||
                          pathname.startsWith("/dashboard/berkas-pimpinan")
                        }
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={
                                pathname.startsWith("/dashboard/arsip") ||
                                pathname.startsWith("/dashboard/berkas-sp") ||
                                pathname.startsWith(
                                  "/dashboard/berkas-pimpinan",
                                )
                              }
                              tooltip="Arsip"
                              className={
                                pathname.startsWith("/dashboard/arsip") ||
                                pathname.startsWith("/dashboard/berkas-sp") ||
                                pathname.startsWith(
                                  "/dashboard/berkas-pimpinan",
                                )
                                  ? "sidebar-arsip-active"
                                  : ""
                              }
                            >
                              <Archive />
                              <span>Arsip</span>
                              <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(
                                    "/dashboard/arsip/surat",
                                  )}
                                  className={
                                    pathname.startsWith(
                                      "/dashboard/arsip/surat",
                                    )
                                      ? "sidebar-submenu-active"
                                      : ""
                                  }
                                >
                                  <Link
                                    href="/dashboard/arsip/surat"
                                    onClick={handleMenuClick}
                                  >
                                    <FileText />
                                    <span>Arsip Surat</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>

                              {user.role === "SEKRETARIS_CABANG" && (
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={pathname.startsWith(
                                      "/dashboard/berkas-sp",
                                    )}
                                    className={
                                      pathname.startsWith(
                                        "/dashboard/berkas-sp",
                                      )
                                        ? "sidebar-submenu-active"
                                        : ""
                                    }
                                  >
                                    <Link
                                      href="/dashboard/berkas-sp"
                                      onClick={handleMenuClick}
                                    >
                                      <FileText />
                                      <span>Berkas SP</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              )}

                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname.startsWith(
                                    "/dashboard/berkas-pimpinan",
                                  )}
                                  className={
                                    pathname.startsWith(
                                      "/dashboard/berkas-pimpinan",
                                    )
                                      ? "sidebar-submenu-active"
                                      : ""
                                  }
                                >
                                  <Link
                                    href="/dashboard/berkas-pimpinan"
                                    onClick={handleMenuClick}
                                  >
                                    <FileText />
                                    <span>
                                      {user.role === "SEKRETARIS_CABANG"
                                        ? "Berkas Cabang"
                                        : "Berkas PAC"}
                                    </span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    )}
                  </React.Fragment>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              <Avatar className="h-8 w-8 rounded-full">
                <AvatarImage
                  src={getUserImageUrl(user) || undefined}
                  alt={user.name || ""}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-full bg-slate-100 text-slate-500 font-medium">
                  {getInitials(user.name || "User")}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {capitalizeName(user.name || "")}
                </span>
                <span className="truncate text-xs text-slate-500">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-slate-400" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  <AvatarImage
                    src={getUserImageUrl(user) || undefined}
                    alt={user.name || ""}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-full bg-slate-100 text-slate-500 font-medium">
                    {getInitials(user.name || "User")}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {capitalizeName(user.name || "")}
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild onSelect={handleMenuClick}>
                <a
                  href={process.env.NEXT_PUBLIC_SSO_URL || "https://pelajarnumagetan.id/dashboard/profil"}
                  className="flex items-center w-full cursor-pointer"
                  onClick={handleMenuClick}
                >
                  <UserIcon className="mr-2 size-4" />
                  <span>Pengaturan Profil</span>
                </a>
              </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href="https://wa.me/6285850512135"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center w-full cursor-pointer"
              >
                <Bug className="mr-2 size-4" />
                <span>Laporkan Bug</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-500 focus:text-red-500 cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 size-4" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
