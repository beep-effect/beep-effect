# Box Drive on the attorney's Windows PC

Install and sign-in steps for Box Drive on a Windows 10 or 11 PC. This is a
physical step: someone sits at the PC. It takes about ten minutes and needs
no administrator help from Box.

Box Drive shows the firm's Box folders in File Explorer as an ordinary drive
folder. Files stay in Box and download when opened, so the PC's disk does not
fill up.

## Before you start

- The PC runs 64-bit Windows 10 or 11 and is signed in as the attorney's own
  Windows user (Box Drive installs per user profile).
- You have the attorney's Box sign-in: the firm email address and the Box
  password, or the firm single sign-on if Box sends you there.
- Word, Excel, and Outlook are closed. The installer adds an Office
  integration and asks to close them otherwise.
- Box Sync (the old sync client) is not installed. If "Box Sync" is listed
  under Settings → Apps, uninstall it first; the two cannot run together.

## Install

1. Open a browser and go to `https://www.box.com/resources/downloads`.
2. Under **Box Drive**, choose **Download Box Drive for Windows (64 bit)**.
   The file is named like `Box-x64.msi`.
3. Open the downloaded file and follow the installer. Accept the Windows
   prompt that asks to allow the install.
4. When the installer finishes, Box Drive starts by itself and opens a
   sign-in window. If it does not, open the Start menu and run **Box Drive**.

## Sign in

1. Enter the attorney's firm email address and choose **Next**.
2. Enter the Box password, or complete the firm single sign-on page if one
   appears.
3. Approve the two-step verification prompt if Box asks for one.
4. Box Drive shows a short welcome tour. Close it.

## Check that it works

1. Open File Explorer. A **Box** entry appears in the left sidebar, and the
   folder lives at `C:\Users\<windows user>\Box`.
2. Open it. The client folders the attorney has access to are listed. Each
   has a small cloud icon, which means "stored in Box, not on this PC yet".
3. Open one client folder, then one matter folder. The numbered matter
   subfolders (`00 Engagement and Administration` through
   `99 Closed Matter Records`) are there.
4. Open any document. It downloads and opens in Word or the PDF reader.
   Close it without changes.
5. In the Windows system tray (bottom right, next to the clock), the Box
   icon shows no red or yellow badge. Click it: the panel says files are up
   to date.

If the Box folder is empty after sign-in, the wrong account is signed in or
the folders have not been shared with this account yet. Click the tray icon,
open the gear menu, and read the signed-in address. Do not create folders to
"fix" an empty view; report it instead.

## Settings worth setting once

Open the tray icon → gear → **Preferences**.

- **Start Box Drive at login**: on.
- **Search**: leave the Box search shortcut on. It searches every Box file
  by name and by words inside the document.
- Leave everything else at its default.

To keep a matter available without internet (travel, a hearing), right-click
the matter folder in File Explorer → **Make Available Offline**. Undo it the
same way when the trip is over, so the disk does not fill.

## Things that confuse people

- **Do not move the Box folder** to another drive or rename it.
- **Do not point OneDrive, a backup tool, or another sync program at the Box
  folder.** Two sync programs fighting over one folder duplicates files.
- **A red badge on the tray icon** means a file could not upload. Click the
  icon to see which file and why. The usual cause is a file name Windows
  allows and Box does not, or a file still open in another program.
- **Deleting in the Box folder deletes in Box** for everyone. Deleted items
  sit in the Box web trash for a while and can be restored there.
- **Outlook attachments**: save an attachment straight into the matter
  folder under the Box drive; there is no separate upload step.

## Report back

Tell the operator:

- Windows version and that Box Drive is installed and signed in as the
  attorney.
- That the client folders appear and one document opened.
- Anything from "Check that it works" that did not match.

The attorney's own guide to using the folders is
[`practice-box-how-to.md`](./practice-box-how-to.md).
