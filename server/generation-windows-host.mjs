// A private Windows Job Object owns the suspended child before it can run.
// Closing the service's stdin pipe (including service crash) closes the job.
// No persisted PID is ever used for termination, so PID reuse is irrelevant.
export const windowsHostScript = String.raw`
param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
public static class GenerationJobHost {
  [StructLayout(LayoutKind.Sequential)] struct SA { public int length; public IntPtr descriptor; public int inherit; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct SI { public int cb; public string reserved, desktop, title; public int x,y,xSize,ySize,xCount,yCount,fill,flags; public short show,reservedSize; public IntPtr reservedPointer,input,output,error; }
  [StructLayout(LayoutKind.Sequential)] struct PI { public IntPtr process,thread; public uint pid,tid; }
  [StructLayout(LayoutKind.Sequential)] struct BASIC { public long processTime,jobTime; public uint flags; public UIntPtr min,max; public uint active; public UIntPtr affinity; public uint priority,scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct IO { public ulong a,b,c,d,e,f; }
  [StructLayout(LayoutKind.Sequential)] struct EXTENDED { public BASIC basic; public IO io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr sa,string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int type,ref EXTENDED info,uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SI si,out PI pi);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateFile(string name,uint access,uint share,ref SA sa,uint creation,uint attrs,IntPtr template);
  [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  static void Check(bool ok) { if (!ok) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()); }
  static string Quote(string value) {
    var result = new StringBuilder("\""); int slashes=0;
    foreach(char ch in value) { if(ch=='\\') {slashes++; continue;} if(ch=='"') {result.Append('\\',slashes*2+1);result.Append('"');} else {result.Append('\\',slashes);result.Append(ch);} slashes=0; }
    result.Append('\\',slashes*2);result.Append('"');return result.ToString();
  }
  public static int Run(string exe,string[] args,string cwd,string input,string output,string error,int timeout) {
    IntPtr job=IntPtr.Zero, ih=IntPtr.Zero, oh=IntPtr.Zero, eh=IntPtr.Zero; PI pi=new PI(); bool assigned=false;
    try {
      job=CreateJobObject(IntPtr.Zero,null);Check(job!=IntPtr.Zero);
      var limits=new EXTENDED();limits.basic.flags=0x2000;Check(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(limits)));
      var sa=new SA {length=Marshal.SizeOf(typeof(SA)),inherit=1};
      ih=CreateFile(input,0x80000000,1,ref sa,3,0x80,IntPtr.Zero);Check(ih!=new IntPtr(-1));
      oh=CreateFile(output,0x40000000,3,ref sa,2,0x80,IntPtr.Zero);Check(oh!=new IntPtr(-1));
      eh=CreateFile(error,0x40000000,3,ref sa,2,0x80,IntPtr.Zero);Check(eh!=new IntPtr(-1));
      var si=new SI {cb=Marshal.SizeOf(typeof(SI)),flags=0x100,input=ih,output=oh,error=eh};
      var cmd=new StringBuilder(Quote(exe));foreach(var arg in args)cmd.Append(" ").Append(Quote(arg));
      Check(CreateProcess(exe,cmd,IntPtr.Zero,IntPtr.Zero,true,0x08000004,IntPtr.Zero,cwd,ref si,out pi));
      Check(AssignProcessToJobObject(job,pi.process));assigned=true;
      Check(ResumeThread(pi.thread)!=0xFFFFFFFF);
      // Task uses a background thread; EOF is bound to this exact parent pipe.
      var disconnected=Task.Factory.StartNew(()=>Console.In.Read());
      var clock=System.Diagnostics.Stopwatch.StartNew();
      while(WaitForSingleObject(pi.process,100)==258) {
        if(disconnected.IsCompleted)return 125;
        if(clock.ElapsedMilliseconds>=timeout)return 124;
        if(new FileInfo(output).Length>8388608 || new FileInfo(error).Length>8388608)return 126;
      }
      uint code;Check(GetExitCodeProcess(pi.process,out code));return unchecked((int)code);
    } finally {
      if(pi.process!=IntPtr.Zero && !assigned)TerminateProcess(pi.process,125);
      if(job!=IntPtr.Zero)CloseHandle(job);
      if(pi.process!=IntPtr.Zero) {WaitForSingleObject(pi.process,10000);CloseHandle(pi.process);}
      if(pi.thread!=IntPtr.Zero)CloseHandle(pi.thread);
      foreach(var h in new[]{ih,oh,eh})if(h!=IntPtr.Zero && h!=new IntPtr(-1))CloseHandle(h);
    }
  }
}
'@
$cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$code = [GenerationJobHost]::Run($cfg.executable, [string[]]$cfg.args, $cfg.cwd, $cfg.promptPath, $cfg.eventsPath, $cfg.stderrPath, [int]$cfg.timeoutMs)
exit $code
`;
