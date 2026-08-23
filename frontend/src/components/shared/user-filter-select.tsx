"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn, capitalizeName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

type User = { id: string; name: string };

interface UserFilterSelectProps {
  users: User[];
  selectedUserId: string;
  onSelectUser: (id: string) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

export function UserFilterSelect({
  users,
  selectedUserId,
  onSelectUser,
  placeholder = "Pilih User",
  allLabel = "Semua PAC",
  className,
}: UserFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedUser = users.find((user) => user.id === selectedUserId);

  return (
    <Popover
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full h-9 justify-between font-normal text-sm bg-white",
            className,
          )}
        >
          <span className="truncate text-left">
            {selectedUserId === "ALL"
              ? allLabel
              : selectedUser
                ? capitalizeName(selectedUser.name)
                : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50 shadow-md border-slate-200">
        <div className="flex flex-col bg-white rounded-md overflow-hidden">
          <div className="p-2 border-b flex items-center gap-2 bg-slate-50/50">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
            <Input
              placeholder="Cari..."
              className="h-8 text-[13px] border-none focus-visible:ring-0 px-0 bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto p-1 custom-scrollbar">
            {search === "" && (
              <div
                className={cn(
                  "flex items-center px-2 py-1.5 text-[13px] rounded-sm cursor-pointer hover:bg-slate-100 transition-colors",
                  selectedUserId === "ALL" &&
                    "bg-slate-100 font-medium text-primary",
                )}
                onClick={() => {
                  onSelectUser("ALL");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-3.5 w-3.5",
                    selectedUserId === "ALL" ? "opacity-100" : "opacity-0",
                  )}
                />
                {allLabel}
              </div>
            )}
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground italic">
                Data tidak ditemukan.
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center px-2 py-1.5 text-[13px] rounded-sm cursor-pointer hover:bg-slate-100 transition-colors",
                    selectedUserId === user.id &&
                      "bg-slate-100 font-medium text-primary",
                  )}
                  onClick={() => {
                    onSelectUser(user.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      selectedUserId === user.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{capitalizeName(user.name)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
