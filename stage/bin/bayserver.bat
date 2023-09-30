@ECHO OFF
set "CMD=npx bayserver"

REM 
REM  Bootstrap script
REM 

set daemon=0
for %%f in (%*) do (
  if "%%f"=="-daemon" (
     set daemon=1
  )
)



if "%daemon%" == "1" (
  start %CMD% %*
) else (
  %CMD% %*
)
