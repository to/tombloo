Tombloo.Service.actions.register({
	name : 'Mosaic - Compound Users',
	execute : function(){
		function parseFormula(f){
			var vals = f.replace(/^/,'+').replace(/\s/g,'').split(/(\+|-)/).slice(1);
			return reduce(function(mem, val){
				mem[val[0]=='+'? 'add' : 'sub'].push(val[1].quote());
				return mem;
			}, vals.split(2), {add:[], sub:[]});
		}
		
		var params = values(input({'Formula: e.g.(a + b - c)' : '', 'Random' : true}));
		if(!params.length)
			return;

		var users = parseFormula(params[0]);
		var sql = [];
		sql.push(Entity.compactSQL(<>
			SELECT *
			FROM 
				photos
			WHERE 
				user IN ({users.add.join(',')})
		</>)); 
		if(users.sub.length){
			sql.push(Entity.compactSQL(<>
				AND imageId NOT IN (
					SELECT 
						imageId
					FROM 
						photos
					WHERE 
						user IN ({users.sub.join(',')})
				)
			</>));
		}
		sql.push('ORDER BY ' + (params[1]? 'random()' : 'date DESC'));
		sql.push('LIMIT 1000');
		
		addTab('chrome://tombloo/content/library/Mosaic.html?' + queryString({
			query : sql.join(' '),
		}));
	},
}, '----');
