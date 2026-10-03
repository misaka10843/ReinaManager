Var ReinaPreviousInstallDir

!macro NSIS_HOOK_PREINSTALL
  ; 安装器随后会覆盖这个值，提前保存用于修复移动目录后失效的快捷方式。
  ReadRegStr $ReinaPreviousInstallDir SHCTX "${MANUPRODUCTKEY}" ""
!macroend

!macro ReinaRepairShortcut shortcut
  !insertmacro IsShortcutTarget "${shortcut}" "$ReinaPreviousInstallDir\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 == 1
    !insertmacro SetShortcutTarget "${shortcut}" "$INSTDIR\${MAINBINARYNAME}.exe"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; 官方更新模式不重建快捷方式，只修复仍指向原安装位置的现有入口。
  ${If} $UpdateMode == 1
  ${AndIf} $ReinaPreviousInstallDir != ""
  ${AndIf} $ReinaPreviousInstallDir != $INSTDIR
    !insertmacro ReinaRepairShortcut "$DESKTOP\${PRODUCTNAME}.lnk"
    !insertmacro ReinaRepairShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    !if "${STARTMENUFOLDER}" != ""
      !insertmacro ReinaRepairShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
    !endif
  ${EndIf}
!macroend
