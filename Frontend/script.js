(() => {
  "use strict";

  // ---- Backend ----
  const API_URL = "https://6xah56w6v56k2nlokc7cqrjh6i0msusz.lambda-url.us-east-1.on.aws/";
  const THEME_KEY = "taskflow.theme";

  async function request(method, { query, body } = {}) {
    const url = query ? `${API_URL}?${new URLSearchParams(query)}` : API_URL;
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* empty or non-JSON body */
    }
    if (!res.ok) throw new Error((data && data.message) || `Request failed (${res.status})`);
    return data;
  }

  const api = {
    getTasks: () => request("GET"),
    addTask: (task) => request("POST", { body: task }),
    updateTask: (id, changes) => request("PUT", { body: { id, ...changes } }),
    deleteTask: (id) => request("DELETE", { query: { id } }),
  };

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const form = $("taskForm");
  const titleInput = $("taskTitle");
  const prioritySelect = $("taskPriority");
  const categorySelect = $("taskCategory");
  const dueInput = $("taskDue");
  const submitBtn = $("submitBtn");
  const cancelEditBtn = $("cancelEdit");
  const searchInput = $("searchInput");
  const sortSelect = $("sortSelect");
  const listEl = $("taskList");
  const emptyEl = $("emptyState");
  const emptyText = emptyEl.querySelector("p");
  const itemsLeftEl = $("itemsLeft");
  const clearBtn = $("clearCompleted");
  const themeBtn = $("themeToggle");
  const toastEl = $("toast");
  const filterBtns = document.querySelectorAll(".filter");

  // ---- State ----
  let tasks = [];
  let filter = "all";
  let editingId = null;
  let loading = true;
  let loadError = false;
  let toastTimer;

  // ---- Helpers ----
  const priorityRank = { high: 0, medium: 1, low: 2 };

  const todayStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.style.opacity = busy ? 0.7 : 1;
  }

  // ---- Data actions (talk to Lambda, then update local state) ----
  async function loadTasks() {
    loading = true;
    loadError = false;
    render();
    try {
      tasks = await api.getTasks();
    } catch (err) {
      loadError = true;
      toast(`Could not load tasks: ${err.message}`);
    } finally {
      loading = false;
      render();
    }
  }

  async function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    try {
      const updated = await api.updateTask(id, { done: !task.done });
      tasks = tasks.map((t) => (t.id === id ? updated : t));
    } catch (err) {
      toast(`Update failed: ${err.message}`);
    }
    render();
  }

  async function deleteTask(id, el) {
    if (el) el.classList.add("removing");
    try {
      await api.deleteTask(id);
      tasks = tasks.filter((t) => t.id !== id);
      if (editingId === id) resetForm();
      toast("Task deleted");
    } catch (err) {
      toast(`Delete failed: ${err.message}`);
    }
    render();
  }

  async function clearCompleted() {
    const done = tasks.filter((t) => t.done);
    if (!done.length) return;
    clearBtn.disabled = true;
    const results = await Promise.allSettled(done.map((t) => api.deleteTask(t.id)));
    const removed = new Set(done.filter((_, i) => results[i].status === "fulfilled").map((t) => t.id));
    tasks = tasks.filter((t) => !removed.has(t.id));
    const failed = done.length - removed.size;
    toast(
      failed
        ? `Cleared ${removed.size}, ${failed} failed`
        : `Cleared ${removed.size} completed task${removed.size === 1 ? "" : "s"}`
    );
    render();
  }

  // ---- Form ----
  function startEdit(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    editingId = id;
    titleInput.value = t.title;
    prioritySelect.value = t.priority;
    categorySelect.value = t.category;
    dueInput.value = t.due || "";
    submitBtn.textContent = "Save Changes";
    cancelEditBtn.classList.remove("hidden");
    titleInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    editingId = null;
    form.reset();
    prioritySelect.value = "medium";
    submitBtn.textContent = "Add Task";
    cancelEditBtn.classList.add("hidden");
  }

  // ---- Rendering ----
  function getVisibleTasks() {
    const q = searchInput.value.trim().toLowerCase();
    let list = tasks.filter((t) => {
      if (filter === "active" && t.done) return false;
      if (filter === "completed" && !t.done) return false;
      if (q && !(t.title.toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q))) return false;
      return true;
    });

    const sort = sortSelect.value;
    return [...list].sort((a, b) => {
      if (sort === "due") {
        if (!a.due && !b.due) return (b.createdAt || 0) - (a.createdAt || 0);
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      }
      if (sort === "priority") return priorityRank[a.priority] - priorityRank[b.priority];
      if (sort === "title") return a.title.localeCompare(b.title);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function renderStats() {
    const today = todayStr();
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const active = total - done;
    const overdue = tasks.filter((t) => !t.done && t.due && t.due < today).length;

    $("statTotal").textContent = total;
    $("statActive").textContent = active;
    $("statDone").textContent = done;
    $("statOverdue").textContent = overdue;
    $("progressBar").style.width = total ? `${(done / total) * 100}%` : "0%";
    itemsLeftEl.textContent = `${active} item${active === 1 ? "" : "s"} left`;
    clearBtn.disabled = done === 0;
    clearBtn.style.opacity = done === 0 ? 0.5 : 1;
  }

  function render() {
    const today = todayStr();
    const visible = getVisibleTasks();
    listEl.innerHTML = "";

    visible.forEach((t) => {
      const li = document.createElement("li");
      li.className = `task ${t.priority}${t.done ? " done" : ""}`;
      li.dataset.id = t.id;

      let dueBadge = "";
      if (t.due) {
        let cls = "";
        let label = `📅 ${formatDate(t.due)}`;
        if (!t.done && t.due < today) {
          cls = "overdue";
          label = `⚠️ Overdue · ${formatDate(t.due)}`;
        } else if (!t.done && t.due === today) {
          cls = "today";
          label = "⏰ Due today";
        }
        dueBadge = `<span class="badge ${cls}">${label}</span>`;
      }

      li.innerHTML = `
        <input type="checkbox" ${t.done ? "checked" : ""} aria-label="Mark complete" />
        <div class="task-body">
          <div class="task-title">${escapeHTML(t.title)}</div>
          <div class="task-meta">
            <span class="badge">${escapeHTML(t.category || "Other")}</span>
            <span class="badge">${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}</span>
            ${dueBadge}
          </div>
        </div>
        <div class="task-actions">
          <button class="edit" title="Edit" aria-label="Edit task">✏️</button>
          <button class="delete" title="Delete" aria-label="Delete task">🗑️</button>
        </div>
      `;
      listEl.appendChild(li);
    });

    if (loading) emptyText.textContent = "Loading tasks...";
    else if (loadError) emptyText.textContent = "Couldn't reach the server. Refresh to try again.";
    else emptyText.textContent = "No tasks to show. Add one above!";

    emptyEl.classList.toggle("hidden", visible.length > 0);
    renderStats();
  }

  // ---- Events ----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;

    const data = {
      title,
      priority: prioritySelect.value,
      category: categorySelect.value,
      due: dueInput.value || "",
    };

    setBusy(true);
    try {
      if (editingId) {
        const updated = await api.updateTask(editingId, data);
        tasks = tasks.map((t) => (t.id === editingId ? updated : t));
        toast("Task updated");
      } else {
        const created = await api.addTask(data);
        tasks = [created, ...tasks];
        toast("Task added");
      }
      resetForm();
    } catch (err) {
      toast(`Save failed: ${err.message}`);
    } finally {
      setBusy(false);
      render();
    }
  });

  cancelEditBtn.addEventListener("click", resetForm);

  listEl.addEventListener("click", (e) => {
    const li = e.target.closest(".task");
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.matches('input[type="checkbox"]')) toggleTask(id);
    else if (e.target.closest(".edit")) startEdit(id);
    else if (e.target.closest(".delete")) deleteTask(id, li);
  });

  filterBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      render();
    })
  );

  searchInput.addEventListener("input", render);
  sortSelect.addEventListener("change", render);
  clearBtn.addEventListener("click", clearCompleted);

  // ---- Theme ----
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  }
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  });

  // ---- Init ----
  (function init() {
    let theme = "light";
    try {
      theme =
        localStorage.getItem(THEME_KEY) ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch {
      /* ignore */
    }
    applyTheme(theme);

    $("todayLabel").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    loadTasks();
  })();
})();
