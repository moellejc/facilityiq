// beforeReadFile. Keeps secret env files out of the model context (Coding Conventions §8).
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const { file_path: filePath = "" } = JSON.parse(raw || "{}");
const BLOCK = [
  /\/\.env(\.(?!example)[^/]*)?$/,
  /\/\.ssh\//,
  /\/id_rsa/,
  /\.pem$/,
  /\/node_modules\//,
  /\/\.next\//,
];
const blocked = BLOCK.some((pattern) => pattern.test(filePath));
process.stdout.write(
  JSON.stringify(
    blocked
      ? { permission: "deny", user_message: `Blocked read of ${filePath}.` }
      : { permission: "allow" },
  ),
);
