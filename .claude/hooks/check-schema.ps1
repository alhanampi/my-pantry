# Reads the PostToolUse JSON payload from stdin and reminds about running
# `prisma migrate dev` when a Write/Edit touched schema.prisma — pure string
# check, no LLM call needed (this replaced an "agent"-type hook that spawned
# a full Claude call on every single file edit just for this check).
$payload = [System.Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $payload.tool_input.file_path
if ($filePath -like '*schema.prisma') {
    Write-Host 'SCHEMA CHANGED - run: cd backend && npx prisma migrate dev'
}
exit 0
