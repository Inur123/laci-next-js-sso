const fs = require("fs");
const file = "src/components/layout/app-sidebar.tsx";
let code = fs.readFileSync(file, "utf8");

code = code.replace(
  /\{pathname === "\/dashboard\/profile" \? \([\s\S]*?\) : \([\s\S]*?<\/[a-zA-Z]*>\s*\)}/m,
  `<DropdownMenuItem asChild onSelect={handleMenuClick}>
                <a
                  href={process.env.NEXT_PUBLIC_SSO_URL || "https://api.pelajarnumagetan.id"}
                  className="flex items-center w-full cursor-pointer"
                  onClick={handleMenuClick}
                >
                  <UserIcon className="mr-2 size-4" />
                  <span>Pengaturan Profil</span>
                </a>
              </DropdownMenuItem>`
);

fs.writeFileSync(file, code);
