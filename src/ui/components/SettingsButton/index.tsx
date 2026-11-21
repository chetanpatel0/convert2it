import { PopupData } from "src/ui";
import { openPopup } from "src/ui/PopupStore";
import { Mode, ModeEnum, toggleMode } from "src/ui/ModeStore";
import { desktopUpdater, Update, type UpdateState } from "src/ui/UpdateStore";
import { InstallPrompt, IsStandalone, promptInstall } from "src/ui/InstallStore";
import { clearAllSiteData } from "src/ui/scripts/siteData";
import { Settings } from "lucide-preact";
import useTooltip from "src/ui/scripts/useTooltip";
import { useRef, useState } from "preact/hooks";
import StyledButton, { ButtonVariant } from "src/ui/components/StyledButton";

import "./index.css";

function getUpdateDescription(update: UpdateState) {
  if (!update.supported) return "Updates aren't available in this build.";

  switch (update.status) {
    case "checking":
      return "Checking for updates…";
    case "up-to-date":
      return "You're on the latest version.";
    case "available":
      return update.canInstall ? "Downloading update…" : "An update is available.";
    case "downloading":
      return `Downloading update… ${Math.round(update.progress)}%`;
    case "downloaded":
      return "The update will be installed when you quit.";
    case "error":
      return "Couldn't check for updates.";
    default:
      return "Not checked yet.";
  }
}

function UpdateButton({ update }: { update: UpdateState }) {
  const updater = desktopUpdater;
  if (!updater) return null;

  if (update.status === "downloaded") {
    return (
      <StyledButton variant={ButtonVariant.Primary} onClick={() => updater.install()}>
        Restart to update
      </StyledButton>
    );
  }

  if (update.status === "available" && !update.canInstall) {
    return (
      <StyledButton variant={ButtonVariant.Primary} onClick={() => updater.openRelease()}>
        Download
      </StyledButton>
    );
  }

  const busy =
    update.status === "checking" ||
    update.status === "downloading" ||
    update.status === "available";

  return (
    <StyledButton disabled={!update.supported || busy} onClick={() => updater.check()}>
      Check for updates
    </StyledButton>
  );
}

function UpdateSettings() {
  const update = Update.value;
  const updater = desktopUpdater;
  if (!update || !updater) return null;

  return (
    <section className="settings-section">
      <h2>Updates</h2>

      <label className="settings-row">
        <div className="settings-row-text">
          <span className="settings-row-title">Automatic updates</span>
          <span className="settings-row-description">
            {update.canInstall
              ? "Download new versions in the background and install them when you quit."
              : "Check for new versions when the app starts."}
          </span>
        </div>
        <input
          type="checkbox"
          role="switch"
          className="settings-switch"
          checked={update.autoUpdate}
          disabled={!update.supported}
          onChange={(ev) => updater.setAutoUpdate(ev.currentTarget.checked)}
        />
      </label>

      <div className="settings-row static">
        <div className="settings-row-text">
          <span className="settings-row-title">Software update</span>
          <span className="settings-row-description" aria-live="polite">
            {getUpdateDescription(update)}
          </span>
        </div>
        <UpdateButton update={update} />
      </div>
    </section>
  );
}

function showInstallHelp() {
  PopupData.value = {
    dismissible: true,
    buttonText: "Got it",
    contents: (
      <>
        <h1>Install Convert2it</h1>
        <p>Once installed it opens in its own window and can receive files from the share menu.</p>
        <ul>
          <li>
            <strong>Android (Chrome/Edge):</strong> menu → “Install app”.
          </li>
          <li>
            <strong>iPhone/iPad (Safari):</strong> Share → “Add to Home Screen”.
          </li>
          <li>
            <strong>Windows/Linux (Chrome/Edge):</strong> click the install icon in the address bar,
            then “Install”.
          </li>
          <li>
            <strong>Firefox:</strong> menu → “Install” where available; otherwise add a bookmark.
          </li>
        </ul>
      </>
    ),
  };
  openPopup();
}

function InstallSettings() {
  const installed = IsStandalone.value;
  const prompt = InstallPrompt.value;

  return (
    <section className="settings-section">
      <h2>Install</h2>
      <div className="settings-row static">
        <div className="settings-row-text">
          <span className="settings-row-title">
            {installed ? "Installed as an app" : "Install Convert2it"}
          </span>
          <span className="settings-row-description">
            {installed
              ? "You're running the installed app. It works offline and can receive shared files."
              : prompt
                ? "Add Convert2it to your home screen or desktop and open it like a native app."
                : "Use your browser's install or “Add to Home Screen” option."}
          </span>
        </div>
        {!installed && (
          <button
            type="button"
            className="settings-action primary"
            onClick={() => {
              if (prompt) void promptInstall();
              else showInstallHelp();
            }}
          >
            {prompt ? "Install" : "How to"}
          </button>
        )}
      </div>
    </section>
  );
}

function DataSettings() {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setClearing(true);
    await clearAllSiteData();
  };

  return (
    <section className="settings-section">
      <h2>Storage</h2>
      <div className="settings-row static">
        <div className="settings-row-text">
          <span className="settings-row-title">Clear cache &amp; site data</span>
          <span className="settings-row-description">
            Deletes the offline cache, downloaded tools and saved settings for this site. Nothing
            you converted is stored, so your files are unaffected.
          </span>
        </div>
        <button
          type="button"
          className={`settings-action danger ${confirming ? "confirm" : ""}`}
          disabled={clearing}
          onClick={() => void handleClear()}
          onBlur={() => setConfirming(false)}
        >
          {clearing ? "Clearing…" : confirming ? "Tap to confirm" : "Clear data"}
        </button>
      </div>
    </section>
  );
}

function SettingsMenu() {
  const isAdvanced = Mode.value === ModeEnum.Advanced;

  return (
    <div className="settings-content">
      <h1>App settings</h1>

      <section className="settings-section">
        <h2>General</h2>

        <label className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-title">Advanced mode</span>
            <span className="settings-row-description">
              Choose which handler to use for each format.
            </span>
          </div>
          <input
            type="checkbox"
            role="switch"
            className="settings-switch"
            checked={isAdvanced}
            onChange={toggleMode}
          />
        </label>
      </section>

      <InstallSettings />
      <UpdateSettings />
      <DataSettings />
    </div>
  );
}

export default function SettingsButton() {
  const btnRef = useRef<HTMLButtonElement>(null);

  useTooltip(btnRef, "App settings");

  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const onSettingsClick = () => {
    PopupData.value = {
      dismissible: true,
      buttonText: "Done",
      className: "settings-popup",
      contents: <SettingsMenu />,
    };
    openPopup();
  };

  return (
    <StyledButton
      buttonRef={btnRef}
      variant={ButtonVariant.Icon}
      ariaLabel="App settings"
      onClick={onSettingsClick}
    >
      <Settings size={18} aria-hidden="true" />
    </StyledButton>
  );
}
