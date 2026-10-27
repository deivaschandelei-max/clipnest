"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);

  const infoForm = $("#info-form");
  const conversionForm = $("#conversion-form");
  const urlInput = $("#video-url");
  const pasteButton = $("#paste-button");
  const fetchButton = $("#fetch-button");
  const convertButton = $("#convert-button");
  const notice = $("#notice");
  const previewCard = $("#preview-card");
  const thumbnail = $("#thumbnail");
  const videoTitle = $("#video-title");
  const videoChannel = $("#video-channel");
  const videoDuration = $("#video-duration");
  const qualityGroup = $("#quality-group");
  const bitrateGroup = $("#bitrate-group");
  const rightsCheck = $("#rights-check");
  const progressSection = $("#progress-section");
  const progressText = $("#progress-text");
  const progressTrack = $("#progress-track");
  const progressFill = $("#progress-fill");
  const resultSection = $("#result-section");
  const resultFilename = $("#result-filename");
  const downloadLink = $("#download-link");
  const resetButton = $("#reset-button");

  const configuredBase = document.documentElement.dataset.apiBaseUrl || "";
  const apiBase = configuredBase.replace(/\/+$/, "");

  let currentVideo = null;
  let currentJob = null;
  let eventSource = null;
  let state = "idle";

  function apiUrl(path) {
    return `${apiBase}${path}`;
  }

  function setState(nextState) {
    state = nextState;
    document.body.dataset.state = nextState;
  }

  function showNotice(message, kind = "") {
    notice.textContent = message;
    notice.className = `notice${kind ? ` ${kind}` : ""}`;
    notice.hidden = false;
  }

  function clearNotice() {
    notice.textContent = "";
    notice.className = "notice";
    notice.hidden = true;
  }

  function setBusy(busy) {
    fetchButton.disabled = busy;
    fetchButton.textContent = busy ? "Fetching…" : "Fetch info";
    urlInput.disabled = busy;
    pasteButton.disabled = busy;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "Duration unavailable";
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      : `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function resetProgress() {
    progressFill.style.width = "0%";
    progressTrack.setAttribute("aria-valuenow", "0");
    progressText.textContent = "Waiting for the worker…";
  }

  function closeEvents() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function resetApp() {
    closeEvents();
    currentVideo = null;
    currentJob = null;
    setState("idle");
    clearNotice();
    previewCard.hidden = true;
    conversionForm.hidden = true;
    progressSection.hidden = true;
    resultSection.hidden = true;
    infoForm.hidden = false;
    urlInput.disabled = false;
    pasteButton.disabled = false;
    fetchButton.disabled = false;
    fetchButton.textContent = "Fetch info";
    rightsCheck.checked = false;
    convertButton.disabled = true;
    resetProgress();
  }

  async function readJson(response) {
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response.");
    }

    if (!response.ok) {
      throw new Error(data.error?.message || data.error || "The request failed.");
    }

    return data;
  }

  pasteButton.addEventListener("click", async () => {
    clearNotice();
    if (!navigator.clipboard?.readText) {
      showNotice("Clipboard access is unavailable. Paste the link into the field manually.", "error");
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showNotice("Your clipboard is empty.", "error");
        return;
      }
      urlInput.value = text.trim();
      urlInput.focus();
    } catch {
      showNotice("Clipboard permission was denied. Paste the link manually instead.", "error");
    }
  });

  infoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice();
    closeEvents();

    const url = urlInput.value.trim();
    if (!url) {
      showNotice("Enter a YouTube video link first.", "error");
      urlInput.focus();
      return;
    }

    setState("loading-info");
    setBusy(true);
    previewCard.hidden = true;
    conversionForm.hidden = true;
    progressSection.hidden = true;
    resultSection.hidden = true;

    try {
      const response = await fetch(apiUrl("/api/info"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      const data = await readJson(response);
      currentVideo = data.video;

      videoTitle.textContent = currentVideo.title;
      videoChannel.textContent = currentVideo.channel || "Channel unavailable";
      videoDuration.textContent = `Duration: ${formatDuration(currentVideo.duration)}`;

      if (currentVideo.thumbnail) {
        thumbnail.src = currentVideo.thumbnail;
        thumbnail.hidden = false;
      } else {
        thumbnail.removeAttribute("src");
        thumbnail.hidden = true;
      }

      previewCard.hidden = false;
      conversionForm.hidden = false;
      infoForm.hidden = false;
      setState("ready");
      showNotice("Video information loaded. Choose a format and confirm your rights.", "success");
      convertButton.disabled = !rightsCheck.checked;
    } catch (error) {
      currentVideo = null;
      setState("error");
      showNotice(error.message || "Unable to fetch video information.", "error");
    } finally {
      setBusy(false);
    }
  });

  document.querySelectorAll('input[name="format"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const isMp3 = document.querySelector('input[name="format"]:checked').value === "mp3";
      qualityGroup.hidden = isMp3;
      bitrateGroup.hidden = !isMp3;
    });
  });

  rightsCheck.addEventListener("change", () => {
    convertButton.disabled = !rightsCheck.checked || !currentVideo ||
      state === "downloading" || state === "loading-info";
  });

  conversionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice();

    if (!currentVideo || !rightsCheck.checked || state !== "ready") {
      showNotice("Fetch video information and confirm that you have download rights first.", "error");
      return;
    }

    const format = document.querySelector('input[name="format"]:checked').value;
    const options = {
      url: currentVideo.url,
      format,
      quality: $("#quality").value,
      bitrate: $("#bitrate").value,
      rightsConfirmed: rightsCheck.checked
    };

    setState("downloading");
    convertButton.disabled = true;
    fetchButton.disabled = true;
    urlInput.disabled = true;
    pasteButton.disabled = true;
    progressSection.hidden = false;
    resultSection.hidden = true;
    resetProgress();
    progressText.textContent = "Adding your job to the queue…";

    try {
      const response = await fetch(apiUrl("/api/jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options)
      });
      const data = await readJson(response);
      currentJob = data.job;

      progressText.textContent = data.job.queued
        ? "Queued. Waiting for an available worker…"
        : "Starting conversion…";

      listenToJob(data.job.id);
    } catch (error) {
      setState("error");
      progressSection.hidden = true;
      showNotice(error.message || "Unable to start conversion.", "error");
      fetchButton.disabled = false;
      urlInput.disabled = false;
      pasteButton.disabled = false;
      convertButton.disabled = false;
    }
  });

  function listenToJob(jobId) {
    closeEvents();
    eventSource = new EventSource(apiUrl(`/api/jobs/${encodeURIComponent(jobId)}/events`));

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data);
        const percent = Math.max(0, Math.min(100, Number(data.percent) || 0));
        progressFill.style.width = `${percent}%`;
        progressTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
        progressText.textContent = data.message || `${Math.round(percent)}% complete`;
      } catch {
        progressText.textContent = "Conversion is in progress…";
      }
    });

    eventSource.addEventListener("queued", (event) => {
      try {
        const data = JSON.parse(event.data);
        progressText.textContent = data.position
          ? `Waiting in queue. Position: ${data.position}.`
          : "Waiting for an available worker…";
      } catch {
        progressText.textContent = "Waiting in queue…";
      }
    });

    eventSource.addEventListener("complete", (event) => {
      closeEvents();
      try {
        const data = JSON.parse(event.data);
        setState("done");
        progressFill.style.width = "100%";
        progressTrack.setAttribute("aria-valuenow", "100");
        progressText.textContent = "Conversion complete.";
        resultFilename.textContent = data.filename;
        downloadLink.href = apiUrl(`/api/jobs/${encodeURIComponent(jobId)}/download`);
        downloadLink.setAttribute("download", data.filename);
        resultSection.hidden = false;
        showNotice("Your file is ready to download.", "success");
      } catch {
        setState("error");
        showNotice("The server finished the job but returned invalid result data.", "error");
      }
    });

    eventSource.addEventListener("job-error", (event) => {
      closeEvents();
      let message = "Conversion failed. Please try again.";
      try {
        message = JSON.parse(event.data).message || message;
      } catch {
        // Keep the safe default message.
      }
      setState("error");
      showNotice(message, "error");
      progressText.textContent = "Conversion failed.";
      convertButton.disabled = false;
    });

    eventSource.onerror = () => {
      if (state === "downloading") {
        progressText.textContent = "Connection interrupted. Reconnecting…";
      }
    };
  }

  resetButton.addEventListener("click", () => {
    resetApp();
    urlInput.value = "";
    urlInput.focus();
  });

  resetApp();
})();
