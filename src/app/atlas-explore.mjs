(function() {
      const app = document.getElementById('atlas-app');
      const navTabs = document.querySelectorAll('.atlas-nav-tabs button');
      const tabbarTabs = document.querySelectorAll('.atlas-tabbar button');
      const allNavButtons = [...navTabs, ...tabbarTabs];
      let currentSection = 'inicio';
      let currentFilter = 'all';
      let exploreNodes = [];

      // Datos del grafo (se cargaran desde DEFAULT_GRAPH o fallback)
      const TYPE_MAP = {
        'clientes': ['Cliente'],
        'procesos': ['Proceso'],
        'productos': ['Producto propio', 'Producto reutilizable'],
        'areas': ['Area'],
        'talento': ['Talento'],
        'herramientas': ['Herramienta'],
        'gobierno': ['Gobierno', 'Control'],
        'finanzas': ['Finanzas']
      };
      const TYPE_LABELS = {
        'clientes': 'Clientes',
        'procesos': 'Procesos',
        'productos': 'Productos',
        'areas': 'Areas',
        'talento': 'Talento',
        'herramientas': 'Herramientas',
        'gobierno': 'Gobierno',
        'finanzas': 'Finanzas'
      };

      function switchTo(section) {
        if (currentSection === section) return;
        currentSection = section;
        app.dataset.atlasSection = section;
        const home = app.querySelector('[data-atlas-home]');
        const processes = app.querySelector('[data-atlas-process]');
        const plan = app.querySelector('[data-atlas-plan]');
        if (home) home.hidden = section !== 'inicio';
        if (processes) processes.hidden = section !== 'procesos';
        if (plan) plan.hidden = section !== 'plan';
        allNavButtons.forEach(b => {
          const isMatch = b.dataset.atlasSectionTarget === section;
          b.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
          b.classList.toggle('active', isMatch);
        });
        // Close explore panel when switching sections
        if (section !== 'explore') {
          document.querySelector('[data-explore-panel]').classList.remove('open');
        }
      }

      allNavButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          switchTo(btn.dataset.atlasSectionTarget);
        });
      });

      // Home card navigation
      document.querySelectorAll('.atlas-home-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          const nav = card.dataset.homeNav;
          if (nav === 'procesos') {
            switchTo('procesos');
          } else if (nav === 'plan') {
            switchTo('plan');
          } else {
            openExplore(nav);
          }
        });
      });

      // EXPLORE functionality
      function openExplore(category) {
        const types = TYPE_MAP[category] || ['Cliente'];
        const label = TYPE_LABELS[category] || 'Items';
        document.querySelector('[data-explore-kind]').textContent = 'Categoria';
        document.querySelector('[data-explore-heading]').textContent = label;

        // Try to get nodes from DEFAULT_GRAPH if available
        const allNodes = (window.DEFAULT_GRAPH && window.DEFAULT_GRAPH.data) ? window.DEFAULT_GRAPH.data : [];
        exploreNodes = allNodes.filter(n => types.includes(n.type));

        // Fallback: generate sample nodes if no data
        if (exploreNodes.length === 0) {
          exploreNodes = generateSampleNodes(category);
        }

        document.querySelector('[data-explore-count]').textContent = exploreNodes.length + ' items';
        renderExploreGrid(exploreNodes);
        switchTo('explore');
      }

      function generateSampleNodes(category) {
        const samples = {
          'clientes': [
            {id:'c1', title:'TechCorp SAS', type:'Cliente', desc:'Cliente tecnologico con proyectos de IA', owner:'Comercial', status:'Activo'},
            {id:'c2', title:'Fundacion Educa', type:'Cliente', desc:'Organizacion sin animo de lucro', owner:'Comercial', status:'Activo'},
            {id:'c3', title:'Alcaldia Mayor', type:'Cliente', desc:'Contrato de servicios digitales', owner:'Direccion', status:'Vigente'},
            {id:'c4', title:'Startup FinTech', type:'Cliente', desc:'Prospecto en negociacion', owner:'Comercial', status:'Prospecto'},
          ],
          'productos': [
            {id:'p1', title:'DashWeb CRM', type:'Producto propio', desc:'Sistema de gestion de clientes', owner:'Tech', status:'Activo'},
            {id:'p2', title:'Buen Puente', type:'Producto propio', desc:'Plataforma de conexion ciudadana', owner:'Direccion', status:'En desarrollo'},
            {id:'p3', title:'Sazon Alacena', type:'Producto reutilizable', desc:'Tienda digital para emprendedores', owner:'Operaciones', status:'Activo'},
          ],
          'talento': [
            {id:'t1', title:'Santiago Rosas', type:'Talento', desc:'CEO y fundador', owner:'Direccion', status:'Activo'},
            {id:'t2', title:'Manuel Mesa', type:'Talento', desc:'COO y orquestador', owner:'Operaciones', status:'Activo'},
            {id:'t3', title:'Martin Lopez', type:'Talento', desc:'Desarrollador interno', owner:'Tech', status:'Internship'},
          ],
          'herramientas': [
            {id:'h1', title:'Supabase', type:'Herramienta', desc:'Base de datos y backend', owner:'Tech', status:'Activo'},
            {id:'h2', title:'DashWeb', type:'Herramienta', desc:'CRM propio de RR', owner:'Operaciones', status:'Activo'},
            {id:'h3', title:'Obsidian', type:'Herramienta', desc:'Vault de conocimiento', owner:'Direccion', status:'Activo'},
          ],
          'gobierno': [
            {id:'g1', title:'Politica de datos', type:'Gobierno', desc:'Manejo de informacion sensible', owner:'Direccion', status:'Documentado'},
            {id:'g2', title:'Modelo de negocio', type:'Gobierno', desc:'Canvas y propuesta de valor', owner:'Direccion', status:'Validado'},
          ],
          'areas': [
            {id:'a1', title:'Direccion', type:'Area', desc:'Toma de decisiones estrategicas', owner:'CEO', status:'Activo'},
            {id:'a2', title:'Operaciones', type:'Area', desc:'Ejecucion y coordinacion', owner:'COO', status:'Activo'},
            {id:'a3', title:'Tech', type:'Area', desc:'Desarrollo e infraestructura', owner:'CTO', status:'Activo'},
          ]
        };
        return samples[category] || [];
      }

      function renderExploreGrid(nodes) {
        const grid = document.querySelector('[data-explore-grid]');
        if (!grid) return;
        grid.innerHTML = nodes.map(node => `
          <article class="explore-card" data-node-id="${node.id}" data-node-type="${node.type}">
            <div class="explore-card-type"><span class="dot"></span>${node.type}</div>
            <h3>${node.title}</h3>
            <p>${node.desc || ''}</p>
            <div class="explore-card-meta">
              ${node.owner ? `<span>${node.owner}</span>` : ''}
              ${node.status ? `<span>${node.status}</span>` : ''}
            </div>
            <div class="explore-card-actions">
              <button data-action="view-detail" data-id="${node.id}">Ver detalle</button>
              <button data-action="view-map" data-id="${node.id}">Ver en mapa</button>
            </div>
          </article>
        `).join('');

        // Add click handlers to cards
        grid.querySelectorAll('.explore-card').forEach(card => {
          card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            openDetail(card.dataset.nodeId);
          });
        });

        grid.querySelectorAll('[data-action="view-detail"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openDetail(btn.dataset.id);
          });
        });

        grid.querySelectorAll('[data-action="view-map"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            goToMap(btn.dataset.id);
          });
        });
      }

      function openDetail(nodeId) {
        const node = exploreNodes.find(n => n.id === nodeId);
        if (!node) return;
        const panel = document.querySelector('[data-explore-panel]');
        const content = document.querySelector('[data-explore-panel-content]');

        content.innerHTML = `
          <div class="panel-type">${node.type}</div>
          <h2>${node.title}</h2>
          <div class="panel-section">
            <h4>Descripcion</h4>
            <p>${node.desc || 'Sin descripcion'}</p>
          </div>
          <div class="panel-section">
            <h4>Informacion</h4>
            <div class="meta-row"><span class="label">Responsable</span><span class="value">${node.owner || 'DESCONOCIDO'}</span></div>
            <div class="meta-row"><span class="label">Estado</span><span class="value">${node.status || 'Por validar'}</span></div>
            <div class="meta-row"><span class="label">ID</span><span class="value">${node.id}</span></div>
          </div>
          <div class="panel-section">
            <h4>Acciones</h4>
            <button class="action-btn" data-action="panel-view-map" data-id="${node.id}">Ver en mapa</button>
            <button class="action-btn" data-action="panel-close">Cerrar</button>
          </div>
        `;

        content.querySelector('[data-action="panel-view-map"]').addEventListener('click', () => goToMap(node.id));
        content.querySelector('[data-action="panel-close"]').addEventListener('click', closeDetail);

        panel.classList.add('open');
      }

      function closeDetail() {
        document.querySelector('[data-explore-panel]').classList.remove('open');
      }

      function goToMap(nodeId) {
        // Navigate to Mapa and (in future) focus on the node
        closeDetail();
        switchTo('mapa');
        // Store selected node for main app to pick up
        window.__atlas_selected_node = nodeId;
      }

      // Search in explore
      const searchInput = document.querySelector('[data-explore-search]');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase();
          const filtered = exploreNodes.filter(n =>
            (n.title || '').toLowerCase().includes(q) ||
            (n.desc || '').toLowerCase().includes(q) ||
            (n.owner || '').toLowerCase().includes(q)
          );
          renderExploreGrid(filtered);
        });
      }

      // Back button from explore
      document.querySelector('[data-action="explore-back"]')?.addEventListener('click', () => {
        switchTo('inicio');
      });

      // Close panel button
      document.querySelector('[data-action="close-explore-panel"]')?.addEventListener('click', closeDetail);

      // Overlay click to close panel
      document.querySelector('[data-atlas-backdrop]')?.addEventListener('click', closeDetail);
    })();
