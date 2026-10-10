using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace KBird
{
    internal static class Launcher
    {
        // Filled by create-desktop-shortcut.ps1 at compile time.
        private const string ProjectRoot = @"__PROJECT_ROOT__";
        private const string BatName = @"__BAT_NAME__";

        [STAThread]
        private static void Main()
        {
            try
            {
                string root = ProjectRoot;
                if (string.IsNullOrWhiteSpace(root) || root.IndexOf("__PROJECT_ROOT__", StringComparison.Ordinal) >= 0)
                {
                    root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(
                        Path.DirectorySeparatorChar,
                        Path.AltDirectorySeparatorChar
                    );
                }

                string batFile = BatName;
                if (string.IsNullOrWhiteSpace(batFile) || batFile.IndexOf("__BAT_NAME__", StringComparison.Ordinal) >= 0)
                {
                    batFile = "KBird-Desktop.bat";
                }

                string bat = Path.Combine(root, batFile);
                if (!File.Exists(bat))
                {
                    MessageBox.Show(
                        "Cannot find launcher script:\n" + bat + "\n\nRebuild the desktop launcher from the KBird project.",
                        "KBird",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = bat,
                    WorkingDirectory = root,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "KBird", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
