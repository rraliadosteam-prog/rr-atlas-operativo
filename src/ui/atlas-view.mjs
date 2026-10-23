import { NODE_COLORS } from '../core/atlas-state.mjs?v=bpmn-6';
import { createMediaTile, isDirectMedia } from './atlas-media.mjs?v=bpmn-6';

const SVG_NS = 'http://www.w3.org/2000/svg';

const clone = (value) => JSON.parse(JSON.stringify(value));

function button(label, className = 'atlas-button') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}

function field(labelText, control) {
  const wrapper = document.createElement('label');
  wrapper.textContent = labelText;
  wrapper.append(control);
  return wrapper;
}

function sectionHeading(text) {
  const heading = document.createElement('h3');
  heading.className = 'atlas-editor-section-title';
  heading.textContent = text;
  return heading;
}

export function createAtlasView({ root, store, onLinkRequest, onMediaRequest, onMediaOpen, onToast, onInspect, onConfirm }) {
  const viewport = { x: 60, y: 50, z: 0.72 };
  let moving = null;
  let connecting = null;
  let drawingShape = null;
  let appearancePreview = null;
  let wiresVisible = true;
  let currentSnapshot = store.getSnapshot();

  const toast = (message, options) => onToast?.(message, options);
  const getNode = (id) => currentSnapshot.state.data.find((node) => node.id === id) ?? null;
  const effectiveNode = (node) => {
    if (!node || !appearancePreview || appearancePreview.id !== node.id) return node;
    return { ...node, shape: appearancePreview.shape, color: appearancePreview.color };
  };
  const visibleNodes = () => {
    const filter = currentSnapshot.filter || 'Todo';
    const query = currentSnapshot.query.trim().toLocaleLowerCase();
    return currentSnapshot.state.data.filter((node) => {
      const matchesFilter = filter === 'Todo' || node.type.toLowerCase().includes(filter.toLowerCase());
      const haystack = [
        node.title,
        node.desc,
        node.owner,
        node.type,
        node.status,
        node.notes,
        ...(node.links ?? []).flat(),
        ...(node.media ?? []).flatMap((asset) => [asset.label, asset.url, asset.kind]),
      ].join(' ').toLocaleLowerCase();
      return matchesFilter && haystack.includes(query);
    });
  };

  let motionToken = 0;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setWorldTransform = () => {
    root.world.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.z})`;
    const where = root.status?.querySelector('[data-atlas-where]');
    if (where) where.textContent = where.textContent.replace(/ · Zoom \d+%$/, '') + ` · Zoom ${Math.round(viewport.z * 100)}%`;
  };
  const animateViewport = (next) => {
    const token = ++motionToken;
    if (reducedMotion()) {
      viewport.x = next.x;
      viewport.y = next.y;
      viewport.z = next.z;
      setWorldTransform();
      return;
    }
    const from = { x: viewport.x, y: viewport.y, z: viewport.z };
    const started = performance.now();
    const run = (now) => {
      if (token !== motionToken) return;
      const progress = Math.min(1, (now - started) / 240);
      const eased = 1 - (1 - progress) ** 3;
      viewport.x = from.x + (next.x - from.x) * eased;
      viewport.y = from.y + (next.y - from.y) * eased;
      viewport.z = from.z + (next.z - from.z) * eased;
      setWorldTransform();
      if (progress < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  };

  const cardBox = (node) => {
    const card = root.cards.querySelector(`[data-id="${node.id}"]`);
    return {
      width: card?.offsetWidth || 238,
      height: card?.offsetHeight || 125,
    };
  };

  const renderWires = (visible) => {
    const valid = new Set(visible.map((node) => node.id));
    root.wires.replaceChildren();
    root.wires.hidden = !wiresVisible;
    if (!wiresVisible) return;
    for (const [sourceId, targetId] of currentSnapshot.state.lines) {
      const source = getNode(sourceId);
      const target = getNode(targetId);
      if (!source || !target || !valid.has(sourceId) || !valid.has(targetId)) continue;
      const sourceSize = cardBox(source);
      const targetSize = cardBox(target);
      const path = document.createElementNS(SVG_NS, 'path');
      const context = sourceId === currentSnapshot.selectedId || targetId === currentSnapshot.selectedId;
      const ax = source.x + sourceSize.width / 2;
      const ay = source.y + sourceSize.height;
      const bx = target.x + targetSize.width / 2;
      const by = target.y;
      path.setAttribute('class', context ? 'context' : 'dim');
      path.dataset.source = sourceId;
      path.dataset.target = targetId;
      path.setAttribute('d', `M${ax},${ay} C${ax},${(ay + by) / 2} ${bx},${(ay + by) / 2} ${bx},${by - 5}`);
      root.wires.appendChild(path);
    }
  };

  const renderMinimap = (visible) => {
    root.minimapCanvas.replaceChildren();
    root.minimapCount.textContent = String(visible.length);
    for (const rawNode of visible) {
      const node = effectiveNode(rawNode);
      const marker = button('', 'atlas-minimap-node');
      marker.classList.toggle('is-active', node.id === currentSnapshot.selectedId);
      marker.style.background = NODE_COLORS[node.color] ?? NODE_COLORS.fuchsia;
      marker.title = node.title;
      marker.setAttribute('aria-label', `Seleccionar ${node.title}`);
      marker.style.left = `${Math.min(98, Math.max(2, (node.x / 4200) * 100))}%`;
      marker.style.top = `${Math.min(98, Math.max(2, (node.y / 3200) * 100))}%`;
      marker.addEventListener('click', () => store.select(node.id));
      root.minimapCanvas.appendChild(marker);
    }
  };

  const renderCards = (visible) => {
    root.cards.replaceChildren();
    for (const rawNode of visible) {
      const node = effectiveNode(rawNode);
      const shape = node.shape || 'rectangle';
      const color = node.color || 'fuchsia';
      const card = document.createElement('article');
      card.className = `atlas-card shape-${shape} tone-${color}${node.id === currentSnapshot.selectedId ? ' is-active' : ''}`;
      card.dataset.id = node.id;
      card.dataset.shape = shape;
      card.dataset.color = color;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-pressed', String(node.id === currentSnapshot.selectedId));
      card.style.left = `${Number(node.x) || 0}px`;
      card.style.top = `${Number(node.y) || 0}px`;
      card.style.width = `${Number(node.width) || 238}px`;
      card.style.minHeight = `${Number(node.height) || 125}px`;
      card.style.setProperty('--node-color', NODE_COLORS[color] ?? NODE_COLORS.fuchsia);
      card.setAttribute('aria-label', `${node.title}, ${node.type}`);

      const marker = document.createElement('span');
      marker.className = 'atlas-card-marker';
      marker.setAttribute('aria-hidden', 'true');
      const kind = document.createElement('span');
      kind.className = 'kind';
      kind.textContent = node.type;
      marker.appendChild(kind);
      if (node.media?.length) {
        const mediaBadge = document.createElement('span');
        mediaBadge.className = 'atlas-media-badge';
        mediaBadge.textContent = `▧ ${node.media.length}`;
        mediaBadge.title = `${node.media.length} recursos multimedia`;
        marker.appendChild(mediaBadge);
      }
      if (node.comments?.length) {
        const commentBadge = document.createElement('span');
        commentBadge.className = 'atlas-comment-badge';
        commentBadge.textContent = `✎ ${node.comments.length}`;
        commentBadge.title = `${node.comments.length} comentarios`;
        marker.appendChild(commentBadge);
      }
      const title = document.createElement('h3');
      title.textContent = node.title;
      const cardMeta = document.createElement('div');
      cardMeta.className = 'atlas-card-meta';
      const state = document.createElement('span');
      state.className = `atlas-card-status atlas-card-status--${String(node.status || 'Por validar').toLowerCase().replaceAll(' ', '-')}`;
      state.textContent = node.status || 'Por validar';
      const owner = document.createElement('span');
      owner.className = 'atlas-card-owner';
      const ownerText = String(node.owner || 'DESCONOCIDO').trim();
      owner.textContent = ownerText === 'DESCONOCIDO' ? '—' : ownerText.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
      owner.title = ownerText;
      cardMeta.append(state, owner);
      const description = document.createElement('p');
      description.textContent = node.desc;
      const previewAsset = node.media?.[0];
      if (previewAsset) {
        const preview = document.createElement('div');
        preview.className = 'atlas-card-media-preview';
        if (previewAsset.kind === 'image' && isDirectMedia(previewAsset)) {
          const image = document.createElement('img');
          image.src = previewAsset.url;
          image.alt = '';
          image.loading = 'lazy';
          image.decoding = 'async';
          preview.appendChild(image);
        } else {
          const icon = document.createElement('span');
          icon.textContent = previewAsset.kind === 'video' ? '▶' : previewAsset.kind === 'audio' ? '♪' : '↗';
          preview.appendChild(icon);
        }
        card.append(title, marker, cardMeta, description, preview);
      } else {
        card.append(title, marker, cardMeta, description);
      }

      card.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        if (connecting) {
          if (connecting !== node.id && store.connect(connecting, node.id)) toast('Conexión creada');
          connecting = null;
          return;
        }
        moving = { id: node.id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y };
        try { card.setPointerCapture(event.pointerId); } catch { /* el puntero ya no está activo */ }
      });
      card.addEventListener('pointermove', (event) => {
        if (!moving || moving.id !== node.id) return;
        const x = Math.round(moving.originX + (event.clientX - moving.startX) / viewport.z);
        const y = Math.round(moving.originY + (event.clientY - moving.startY) / viewport.z);
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
      });
      card.addEventListener('pointerup', (event) => {
        if (!moving || moving.id !== node.id) return;
        const travel = Math.hypot(event.clientX - moving.startX, event.clientY - moving.startY);
        const x = Number.parseFloat(card.style.left);
        const y = Number.parseFloat(card.style.top);
        moving = null;
        if (travel < 8) {
          store.select(node.id);
          onInspect?.(node.id);
          return;
        }
        if (Number.isFinite(x) && Number.isFinite(y)) store.moveNode(node.id, x, y);
      });
      card.addEventListener('pointercancel', () => { moving = null; });
      card.addEventListener('click', () => { if (!moving) store.select(node.id); });
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        store.select(node.id);
        onInspect?.(node.id);
      });
      root.cards.appendChild(card);
    }
  };

  const renderEditor = () => {
    root.editor.replaceChildren();
    const node = getNode(currentSnapshot.selectedId);
    if (!node) {
      const empty = document.createElement('p');
      empty.className = 'atlas-empty';
      empty.textContent = 'Selecciona un nodo o crea uno nuevo.';
      root.editor.appendChild(empty);
      return;
    }

    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.textContent = node.type;
    const heading = document.createElement('h2');
    heading.textContent = node.title;
    root.editor.append(kind, heading);

    const title = document.createElement('input');
    title.value = node.title;
    root.editor.appendChild(field('Título', title));

    const type = document.createElement('select');
    for (const optionValue of root.types) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      option.selected = optionValue === node.type;
      type.appendChild(option);
    }
    root.editor.appendChild(field('Tipo', type));

    const description = document.createElement('textarea');
    description.value = node.desc;
    root.editor.appendChild(field('Descripción / alcance', description));

    const owner = document.createElement('input');
    owner.value = node.owner || '';
    root.editor.appendChild(field('Responsable', owner));

    const status = document.createElement('input');
    status.value = node.status || '';
    root.editor.appendChild(field('Estado', status));

    const notes = document.createElement('textarea');
    notes.value = node.notes || '';
    root.editor.appendChild(field('Notas y próximos pasos', notes));

    const appearance = document.createElement('section');
    appearance.className = 'atlas-editor-section';
    appearance.appendChild(sectionHeading('Apariencia del marcador'));
    const shape = document.createElement('select');
    for (const optionValue of root.shapes) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = root.shapeLabels[optionValue] ?? optionValue;
      option.selected = optionValue === (node.shape || 'rectangle');
      shape.appendChild(option);
    }
    appearance.appendChild(field('Figura', shape));

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    const palette = document.createElement('div');
    palette.className = 'atlas-palette';
    const colorAlias = { moss: 'orchid', blue: 'paper', flag: 'fuchsia' };
    const originalColor = node.color || 'fuchsia';
    let selectedColor = originalColor;
    let palettePick = colorAlias[originalColor] || originalColor;
    for (const colorName of root.colors) {
      const swatch = button('', 'atlas-color-swatch');
      swatch.dataset.color = colorName;
      swatch.title = root.colorLabels[colorName] ?? colorName;
      swatch.style.background = NODE_COLORS[colorName];
      swatch.setAttribute('aria-label', `Usar color ${root.colorLabels[colorName] ?? colorName}`);
      swatch.classList.toggle('is-active', colorName === palettePick);
      swatch.addEventListener('click', () => {
        selectedColor = colorName;
        palettePick = colorName;
        palette.querySelectorAll('.atlas-color-swatch').forEach((item) => item.classList.toggle('is-active', item.dataset.color === colorName));
        updateAppearancePreview();
      });
      palette.appendChild(swatch);
    }
    colorLabel.appendChild(palette);
    appearance.appendChild(colorLabel);

    const previewFeedback = document.createElement('p');
    previewFeedback.className = 'atlas-editor-feedback';
    previewFeedback.setAttribute('role', 'status');
    const updateAppearancePreview = () => {
      const nextShape = shape.value;
      const dirty = nextShape !== (node.shape || 'rectangle') || selectedColor !== (node.color || 'fuchsia');
      appearancePreview = { id: node.id, shape: nextShape, color: selectedColor };
      refreshMap();
      previewFeedback.textContent = dirty
        ? `Vista previa aplicada al nodo: ${root.shapeLabels[nextShape] ?? nextShape} · ${root.colorLabels[selectedColor] ?? selectedColor}. Todavía no está guardado.`
        : 'Elige una figura o color para previsualizarlo directamente sobre el nodo seleccionado.';
    };
    shape.addEventListener('change', updateAppearancePreview);
    updateAppearancePreview();
    appearance.append(previewFeedback);
    root.editor.appendChild(appearance);

    const actions = document.createElement('div');
    actions.className = 'row';
    const save = button('Aplicar cambios', 'atlas-button atlas-button--primary');
    const discard = button('Descartar cambios');
    const remove = button('Eliminar', 'atlas-button atlas-button--danger');
    save.addEventListener('click', () => {
      appearancePreview = null;
      refreshMap();
      store.updateNode(node.id, {
        title: title.value.trim() || 'Sin título',
        type: type.value,
        desc: description.value,
        owner: owner.value,
        status: status.value,
        notes: notes.value,
        shape: shape.value,
        color: selectedColor,
      });
      toast(`Aplicado: ${root.shapeLabels[shape.value] ?? shape.value} · ${selectedColor}`);
    });
    discard.addEventListener('click', () => {
      appearancePreview = null;
      refreshMap();
      store.select(node.id);
      toast('Cambios descartados');
    });
    remove.addEventListener('click', () => {
      onConfirm?.({
        title: 'Eliminar nodo',
        message: `Se eliminará «${node.title}» y sus conexiones. Esta acción se puede deshacer desde el aviso.`,
        confirmLabel: 'Eliminar nodo',
        onConfirm: () => {
          store.deleteNode(node.id);
          toast('Nodo eliminado', { undo: true });
        },
      });
    });
    actions.append(save, discard, remove);
    root.editor.appendChild(actions);

    const commentsSection = document.createElement('section');
    commentsSection.className = 'atlas-editor-section';
    commentsSection.appendChild(sectionHeading(`Comentarios · ${(node.comments ?? []).length}`));
    const commentsHelp = document.createElement('p');
    commentsHelp.className = 'atlas-muted';
    commentsHelp.textContent = 'Notas locales de coordinación. No se sincronizan con una fuente externa todavía.';
    commentsSection.appendChild(commentsHelp);
    const commentsList = document.createElement('div');
    commentsList.className = 'atlas-comments-list';
    for (const comment of node.comments ?? []) {
      const item = document.createElement('article');
      item.className = 'atlas-comment-item mat-row';
      const date = document.createElement('span');
      date.className = 'kind';
      date.textContent = comment.updatedAt ? `Actualizado ${new Date(comment.updatedAt).toLocaleString('es-CO')}` : 'Comentario local';
      const input = document.createElement('textarea');
      input.value = comment.text;
      input.setAttribute('aria-label', 'Comentario');
      const commentActions = document.createElement('div');
      commentActions.className = 'row';
      const saveComment = button('Guardar comentario', 'atlas-button atlas-button--primary');
      saveComment.addEventListener('click', () => {
        if (store.updateComment(node.id, comment.id, input.value)) toast('Comentario actualizado');
      });
      const removeComment = button('Quitar', 'atlas-button atlas-button--danger');
      removeComment.addEventListener('click', () => onConfirm?.({
        title: 'Quitar comentario',
        message: 'Esta nota local se quitará del nodo.',
        confirmLabel: 'Quitar comentario',
        onConfirm: () => {
          store.removeComment(node.id, comment.id);
          toast('Comentario quitado');
        },
      }));
      commentActions.append(saveComment, removeComment);
      item.append(date, input, commentActions);
      commentsList.appendChild(item);
    }
    if (!(node.comments ?? []).length) {
      const emptyComments = document.createElement('p');
      emptyComments.className = 'atlas-muted';
      emptyComments.textContent = 'Todavía no hay comentarios en este nodo.';
      commentsList.appendChild(emptyComments);
    }
    commentsSection.appendChild(commentsList);
    const newComment = document.createElement('textarea');
    newComment.placeholder = 'Deja una nota para el siguiente recorrido';
    newComment.setAttribute('aria-label', 'Nuevo comentario');
    commentsSection.appendChild(newComment);
    const addComment = button('＋ Dejar comentario', 'atlas-button atlas-button--primary');
    addComment.addEventListener('click', () => {
      if (store.addComment(node.id, newComment.value)) {
        newComment.value = '';
        toast('Comentario guardado en este navegador');
      }
    });
    commentsSection.appendChild(addComment);
    root.editor.appendChild(commentsSection);

    const mediaSection = document.createElement('section');
    mediaSection.className = 'atlas-editor-section';
    mediaSection.appendChild(sectionHeading(`Multimedia · ${(node.media ?? []).length}`));
    const mediaHelp = document.createElement('p');
    mediaHelp.className = 'atlas-muted';
    mediaHelp.textContent = 'Fotos, videos, audio, PDF y documentos. Drive se abre en vista previa cuando el navegador lo permite.';
    mediaSection.appendChild(mediaHelp);
    const mediaGrid = document.createElement('div');
    mediaGrid.className = 'atlas-media-grid';
    for (const asset of node.media ?? []) {
      mediaGrid.appendChild(createMediaTile({
        asset,
        onOpen: onMediaOpen,
        onRemove: (selected) => {
          onConfirm?.({
            title: 'Quitar recurso',
            message: `Se quitará «${selected.label}» de este nodo.`,
            confirmLabel: 'Quitar recurso',
            onConfirm: () => {
              store.removeMedia(node.id, selected.id);
              toast('Recurso multimedia quitado');
            },
          });
        },
      }));
    }
    if (!(node.media ?? []).length) {
      const emptyMedia = document.createElement('p');
      emptyMedia.className = 'atlas-muted';
      emptyMedia.textContent = 'Todavía no hay fotos ni archivos montados.';
      mediaGrid.appendChild(emptyMedia);
    }
    mediaSection.appendChild(mediaGrid);
    const addMedia = button('＋ Agregar foto, video o archivo', 'atlas-button atlas-button--primary');
    addMedia.addEventListener('click', () => onMediaRequest?.(node.id));
    mediaSection.appendChild(addMedia);
    root.editor.appendChild(mediaSection);

    const docsSection = document.createElement('section');
    docsSection.className = 'atlas-editor-section';
    docsSection.appendChild(sectionHeading(`Enlaces de Drive · ${node.links.length}`));
    const help = document.createElement('p');
    help.className = 'atlas-muted';
    help.textContent = 'Referencias simples para documentos y carpetas. No copia archivos ni guarda tokens.';
    docsSection.appendChild(help);
    const list = document.createElement('div');
    for (const [index, [name, url]] of node.links.entries()) {
      const row = document.createElement('div');
      row.className = 'atlas-doc';
      const removeLink = button('×', 'atlas-button atlas-button--icon');
      removeLink.setAttribute('aria-label', `Quitar ${name}`);
      removeLink.addEventListener('click', () => { store.removeLink(node.id, index); toast('Enlace quitado'); });
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = `${name} ↗`;
      row.append(removeLink, anchor);
      list.appendChild(row);
    }
    if (!node.links.length) {
      const emptyLinks = document.createElement('p');
      emptyLinks.className = 'atlas-muted';
      emptyLinks.textContent = 'Sin documentos vinculados.';
      list.appendChild(emptyLinks);
    }
    docsSection.appendChild(list);
    const linkButton = button('＋ Asociar enlace de Drive');
    linkButton.addEventListener('click', () => onLinkRequest?.(node.id));
    docsSection.appendChild(linkButton);
    root.editor.appendChild(docsSection);

    const notice = document.createElement('p');
    notice.className = 'atlas-notice';
    notice.textContent = 'Los cambios de este mapa se guardan en este navegador.';
    root.editor.appendChild(notice);
  };

  const render = (snapshot) => {
    if (appearancePreview && (appearancePreview.id !== snapshot.selectedId || snapshot.reason === 'update-node')) appearancePreview = null;
    currentSnapshot = snapshot;
    const visible = visibleNodes();
    const mediaCount = snapshot.state.data.reduce((total, node) => total + (node.media?.length ?? 0), 0);
    root.count.textContent = `${visible.length} de ${snapshot.state.data.length} nodos · ${snapshot.state.lines.length} conexiones · ${mediaCount} recursos`;
    const narrow = root.work.clientWidth < 761;
    const selected = snapshot.state.data.find((node) => node.id === snapshot.selectedId);
    const place = selected
      ? `${visible.length} de ${snapshot.state.data.length} · ${selected.type}`
      : `${visible.length} de ${snapshot.state.data.length} en pantalla`;
    const where = root.status.querySelector('[data-atlas-where]') || root.status;
    const zoomLabel = ` · Zoom ${Math.round(viewport.z * 100)}%`;
    if (snapshot.query && !visible.length) where.textContent = 'Ningún nodo coincide con la búsqueda.' + zoomLabel;
    else if (snapshot.reason === 'init') where.textContent = (narrow
      ? 'Arrastra el fondo o pellizca para acercar.'
      : 'Arrastra el fondo o usa la rueda para acercar.') + zoomLabel;
    else where.textContent = place + zoomLabel;
    root.railButtons.forEach((buttonElement) => {
      buttonElement.setAttribute('aria-pressed', String(buttonElement.dataset.atlasFilter === snapshot.filter));
    });
    root.layout?.closest('#atlas-app')?.querySelectorAll?.('[data-atlas-filter-count]')?.forEach((countElement) => {
      const filter = countElement.dataset.atlasFilterCount;
      const count = filter === 'Todo'
        ? snapshot.state.data.length
        : snapshot.state.data.filter((node) => node.type.toLowerCase().includes(filter.toLowerCase())).length;
      countElement.textContent = String(count);
    });
    renderCards(visible);
    renderWires(visible);
    renderMinimap(visible);
    renderEditor();
    setWorldTransform();
    if (snapshot.reason === 'init') requestAnimationFrame(() => {
      if (window.matchMedia('(min-width: 761px)').matches && visible.length > 12) fitVisible();
      else frameReadable();
    });
  };

  const clampZoom = (zoom) => {
    return Math.max(0.1, Math.min(3, zoom));
  };

  const zoomAt = (factor, clientX = root.work.getBoundingClientRect().left + root.work.clientWidth / 2, clientY = root.work.getBoundingClientRect().top + root.work.clientHeight / 2) => {
    const rect = root.work.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const next = clampZoom(viewport.z * factor);
    animateViewport({
      z: next,
      x: px - ((px - viewport.x) / viewport.z) * next,
      y: py - ((py - viewport.y) / viewport.z) * next,
    });
  };

  const panBy = (dx, dy) => {
    motionToken += 1;
    viewport.x += dx;
    viewport.y += dy;
    setWorldTransform();
  };

  const beginDrawing = (event) => {
    const rect = root.work.getBoundingClientRect();
    const start = {
      x: (event.clientX - rect.left - viewport.x) / viewport.z,
      y: (event.clientY - rect.top - viewport.y) / viewport.z,
    };
    const preview = document.createElement('div');
    preview.className = `atlas-draw-preview shape-${drawingShape}`;
    preview.style.left = `${start.x}px`;
    preview.style.top = `${start.y}px`;
    preview.style.width = '120px';
    preview.style.height = '64px';
    root.cards.appendChild(preview);
    try { root.work.setPointerCapture(event.pointerId); } catch { /* captura opcional */ }
    const update = (next) => {
      const current = {
        x: (next.clientX - rect.left - viewport.x) / viewport.z,
        y: (next.clientY - rect.top - viewport.y) / viewport.z,
      };
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const width = Math.max(120, Math.abs(current.x - start.x));
      const height = Math.max(64, Math.abs(current.y - start.y));
      preview.style.left = `${Math.max(0, x)}px`;
      preview.style.top = `${Math.max(0, y)}px`;
      preview.style.width = `${width}px`;
      preview.style.height = `${height}px`;
    };
    const finish = (next) => {
      root.work.removeEventListener('pointermove', update);
      root.work.removeEventListener('pointerup', finish);
      root.work.removeEventListener('pointercancel', finish);
      preview.remove();
      if (next.type === 'pointercancel') {
        drawingShape = null;
        root.work.classList.remove('is-drawing');
        return;
      }
      update(next);
      const width = Math.round(Number.parseFloat(preview.style.width));
      const height = Math.round(Number.parseFloat(preview.style.height));
      const x = Math.round(Number.parseFloat(preview.style.left));
      const y = Math.round(Number.parseFloat(preview.style.top));
      const shape = drawingShape;
      const labels = { rectangle: 'Rectángulo', rounded: 'Marcador redondeado', circle: 'Círculo', diamond: 'Rombo', hexagon: 'Hexágono', note: 'Nota' };
      drawingShape = null;
      root.work.classList.remove('is-drawing');
      store.addNode({
        id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: shape === 'note' ? 'Nueva nota' : `Dibujo ${labels[shape] ?? 'libre'}`,
        type: 'Otro',
        desc: shape === 'note' ? 'Anotación local del mapa.' : 'Elemento creado desde la herramienta Dibujar.',
        x: Math.max(20, x),
        y: Math.max(20, y),
        width: Math.min(640, Math.max(120, width)),
        height: Math.min(480, Math.max(64, height)),
        shape,
        color: 'orchid',
      });
      toast(`${labels[shape] ?? 'Elemento'} creado; puedes editarlo y comentar`);
    };
    root.work.addEventListener('pointermove', update);
    root.work.addEventListener('pointerup', finish);
    root.work.addEventListener('pointercancel', finish);
    update(event);
  };

  const pan = (event) => {
    if (event.target.closest('button, input, textarea, select, a')) return;
    motionToken += 1;
    const start = { x: event.clientX, y: event.clientY, ox: viewport.x, oy: viewport.y };
    let last = { x: event.clientX, y: event.clientY, t: performance.now(), vx: 0, vy: 0 };
    let moved = 0;
    const move = (next) => {
      if (pointers.size > 1) return;
      const now = performance.now();
      const dt = Math.max(1, now - last.t);
      last = {
        x: next.clientX,
        y: next.clientY,
        t: now,
        vx: (next.clientX - last.x) / dt,
        vy: (next.clientY - last.y) / dt,
      };
      moved = Math.hypot(next.clientX - start.x, next.clientY - start.y);
      viewport.x = start.ox + next.clientX - start.x;
      viewport.y = start.oy + next.clientY - start.y;
      setWorldTransform();
    };
    const end = (next) => {
      root.work.removeEventListener('pointermove', move);
      root.work.removeEventListener('pointerup', end);
      root.work.removeEventListener('pointercancel', end);
      if (next.type === 'pointercancel') return;
      const now = performance.now();
      if (moved < 8 && now - lastTap.t < 280 && Math.hypot(next.clientX - lastTap.x, next.clientY - lastTap.y) < 28) {
        const rect = root.work.getBoundingClientRect();
        const floor = root.work.clientWidth < 761 ? 0.55 : 0.35;
        const zoom = Math.max(floor, Math.min(2.4, viewport.z * 1.35));
        const px = next.clientX - rect.left;
        const py = next.clientY - rect.top;
        animateViewport({
          z: zoom,
          x: px - ((px - viewport.x) / viewport.z) * zoom,
          y: py - ((py - viewport.y) / viewport.z) * zoom,
        });
        lastTap = { t: 0, x: 0, y: 0 };
        return;
      }
      lastTap = { t: now, x: next.clientX, y: next.clientY };
      if (reducedMotion() || moved < 8) return;
      const token = ++motionToken;
      let vx = last.vx * 16;
      let vy = last.vy * 16;
      const glide = () => {
        if (token !== motionToken) return;
        vx *= 0.9;
        vy *= 0.9;
        if (Math.hypot(vx, vy) < 0.35) return;
        viewport.x += vx;
        viewport.y += vy;
        setWorldTransform();
        requestAnimationFrame(glide);
      };
      requestAnimationFrame(glide);
    };
    root.work.addEventListener('pointermove', move);
    root.work.addEventListener('pointerup', end);
    root.work.addEventListener('pointercancel', end);
  };
  let lastTap = { t: 0, x: 0, y: 0 };
  const pointers = new Map();
  let pinch = null;
  const pinchDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };
  root.work.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, input, textarea, select, a, .atlas-minimap')) return;
    if (drawingShape) {
      beginDrawing(event);
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { root.work.setPointerCapture(event.pointerId); } catch { /* captura opcional */ }
    if (pointers.size === 2) {
      pinch = { distance: pinchDistance(), z: viewport.z };
      return;
    }
    pan(event);
  });
  root.work.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || pointers.size < 2) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.preventDefault();
    const values = [...pointers.values()];
    const [a, b] = values;
    const distance = pinchDistance();
    if (!pinch) pinch = { distance, z: viewport.z };
    const rect = root.work.getBoundingClientRect();
    const px = ((a.x + b.x) / 2) - rect.left;
    const py = ((a.y + b.y) / 2) - rect.top;
    const next = clampZoom(pinch.z * (distance / pinch.distance));
    viewport.x = px - ((px - viewport.x) / viewport.z) * next;
    viewport.y = py - ((py - viewport.y) / viewport.z) * next;
    viewport.z = next;
    setWorldTransform();
  }, { passive: false });
  const releasePointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
  };
  root.work.addEventListener('pointerup', releasePointer);
  root.work.addEventListener('pointercancel', releasePointer);
  window.addEventListener('blur', () => {
    pointers.clear();
    pinch = null;
    moving = null;
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    pointers.clear();
    pinch = null;
    moving = null;
  });
  root.work.addEventListener('wheel', (event) => {
    if (event.target.closest('input, textarea, select')) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.work.clientHeight : 100;
    const normalized = Math.max(-4, Math.min(4, event.deltaY / unit));
    zoomAt(Math.exp(-normalized * 0.16), event.clientX, event.clientY);
  }, { passive: false });

  const refreshMap = () => {
    const visible = visibleNodes();
    renderCards(visible);
    renderWires(visible);
    renderMinimap(visible);
    setWorldTransform();
  };

  const frameNode = (node) => {
    if (!node || !root.work.clientWidth) return;
    const narrow = root.work.clientWidth < 761;
    const size = cardBox(node);
    const zoom = narrow ? 1 : 0.85;
    const cx = (Number(node.x) || 0) + size.width / 2;
    const cy = (Number(node.y) || 0) + size.height / 2;
    animateViewport({
      z: zoom,
      x: root.work.clientWidth / 2 - cx * zoom,
      y: root.work.clientHeight * 0.36 - cy * zoom,
    });
  };

  const frameReadable = () => {
    const visible = visibleNodes();
    const selected = visible.find((node) => node.id === currentSnapshot.selectedId) || visible[0];
    frameNode(selected);
  };

  const fitVisible = () => {
    const visible = visibleNodes();
    if (!visible.length || !root.work.clientWidth) return;
    const boxes = visible.map((node) => ({ node, size: cardBox(node) }));
    const minX = Math.min(...boxes.map(({ node }) => node.x));
    const maxX = Math.max(...boxes.map(({ node, size }) => node.x + size.width));
    const minY = Math.min(...boxes.map(({ node }) => node.y));
    const maxY = Math.max(...boxes.map(({ node, size }) => node.y + size.height));
    const width = Math.max(1, root.work.clientWidth - 64);
    const height = Math.max(1, root.work.clientHeight - 64);
    const next = clampZoom(Math.min(width / Math.max(280, maxX - minX), height / Math.max(180, maxY - minY)));
    animateViewport({
      z: next,
      x: root.work.clientWidth / 2 - ((minX + maxX) / 2) * next,
      y: root.work.clientHeight / 2 - ((minY + maxY) / 2) * next,
    });
  };

  const focusVisible = () => fitVisible();

  const frameSelected = () => {
    const selected = getNode(currentSnapshot.selectedId);
    if (selected) frameNode(selected);
    else fitVisible();
  };

  const exportNodeIds = (scope = 'visible') => {
    const selected = currentSnapshot.selectedId;
    if (scope === 'full') return currentSnapshot.state.data.map((node) => node.id);
    if (scope === 'visible') return visibleNodes().map((node) => node.id);
    if (!selected) return visibleNodes().map((node) => node.id);
    const ids = new Set([selected]);
    for (const [source, target] of currentSnapshot.state.lines) {
      if (source === selected) ids.add(target);
      if (target === selected) ids.add(source);
    }
    return [...ids];
  };

  const escapeXml = (value) => String(value ?? '').replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character]));
  const exportSvg = (scope = 'visible') => {
    const ids = new Set(exportNodeIds(scope));
    const nodes = currentSnapshot.state.data.filter((node) => ids.has(node.id));
    if (!nodes.length) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><text x="32" y="48">Sin nodos para exportar</text></svg>';
    const padding = 56;
    const boxes = nodes.map((node) => ({ node, width: Number(node.width) || 238, height: Number(node.height) || 125 }));
    const minX = Math.min(...boxes.map(({ node }) => node.x));
    const minY = Math.min(...boxes.map(({ node }) => node.y));
    const maxX = Math.max(...boxes.map(({ node, width }) => node.x + width));
    const maxY = Math.max(...boxes.map(({ node, height }) => node.y + height));
    const width = Math.max(640, maxX - minX + padding * 2);
    const height = Math.max(360, maxY - minY + padding * 2);
    const point = (value, offset) => value - offset + padding;
    const edges = currentSnapshot.state.lines.filter(([source, target]) => ids.has(source) && ids.has(target)).map(([source, target]) => {
      const a = boxes.find(({ node }) => node.id === source);
      const b = boxes.find(({ node }) => node.id === target);
      const ax = point(a.node.x + a.width / 2, minX);
      const ay = point(a.node.y + a.height, minY);
      const bx = point(b.node.x + b.width / 2, minX);
      const by = point(b.node.y, minY);
      return `<path d="M${ax} ${ay} C${ax} ${(ay + by) / 2} ${bx} ${(ay + by) / 2} ${bx} ${by}"/>`;
    }).join('');
    const cards = boxes.map(({ node, width: nodeWidth, height: nodeHeight }) => {
      const color = NODE_COLORS[node.color] ?? NODE_COLORS.fuchsia;
      const x = point(node.x, minX);
      const y = point(node.y, minY);
      return `<g><rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="10" fill="#200b1b" stroke="${color}" stroke-width="3"/><text x="${x + 16}" y="${y + 26}" fill="#ded116" font-size="12" font-family="Arial" letter-spacing="1">${escapeXml(node.type)}</text><text x="${x + 16}" y="${y + 52}" fill="#fffff3" font-size="17" font-family="Arial">${escapeXml(node.title)}</text><text x="${x + 16}" y="${y + 78}" fill="#d2abc2" font-size="12" font-family="Arial">${escapeXml(node.desc).slice(0, 120)}</text></g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#0e030b"/><g fill="none" stroke="#973d8f" stroke-width="2" opacity=".7">${edges}</g>${cards}<text x="${padding}" y="${height - 18}" fill="#d2abc2" font-size="11" font-family="Arial">RR Atlas · ${escapeXml(scope)} · fixture local</text></svg>`;
  };

  return Object.freeze({
    render,
    startConnecting() {
      if (!currentSnapshot.selectedId) { toast('Selecciona un nodo primero'); return; }
      connecting = currentSnapshot.selectedId;
      toast('Selecciona un segundo nodo para crear la conexión');
    },
    startDrawing(shape) {
      drawingShape = shape;
      root.work.classList.add('is-drawing');
      toast(`Dibujar ${shape}: arrastra para definir tamaño`);
    },
    previewAppearance(id, shape, color) {
      appearancePreview = { id, shape, color };
      refreshMap();
    },
    clearAppearancePreview() {
      appearancePreview = null;
      refreshMap();
    },
    focusVisible,
    frameNode(id) { frameNode(getNode(id) || visibleNodes()[0]); },
    frameSelected,
    exportNodeIds,
    exportSvg,
    panBy,
    toggleWires() {
      wiresVisible = !wiresVisible;
      refreshMap();
      return wiresVisible;
    },
    center() { fitVisible(); },
    zoomIn() { zoomAt(1.2); },
    zoomOut() { zoomAt(1 / 1.2); },
    zoomTo(level) {
      const factor = level / Math.max(0.01, viewport.z);
      zoomAt(factor);
    },
    getSnapshot: () => clone(currentSnapshot),
  });
}
