var Tombloo = {
	get root(){
		return (this._root || (this._root = getDataDir())).clone();
	},
	set root(root){
		return this._root = root;
	},
	get db(){
		if(this._db)
			return this._db;
		
		var file = this.root;
		file.append('tombloo.sqlite');
		
		return this.db = new Database(file);
	},
	set db(db){
		this._db = db;
		this.initialize();
		return db;
	},
	initialize : function(){
		with(Tombloo){
			Regular.initialize();
			Photo.initialize();
			Video.initialize();
			Link.initialize();
			Conversation.initialize();
			Quote.initialize();
			
			Post.initialize();
		}
	},
	Entity : function(def){
		var Clazz = Entity(def);
		extend(Clazz, {
			get_db : function(){
				return Tombloo.db;
			},
		})
		return Clazz;
	},
}


Tombloo.Regular = Tombloo.Entity({
	name : 'regulars',
	fields : {
		id   : 'INTEGER PRIMARY KEY',
		user : 'TEXT',
		date : 'TIMESTAMP',
		
		title : 'TEXT',
		body : 'TEXT',
	}
});

Tombloo.Photo = Tombloo.Entity({
	name : 'photos',
	fields : {
		id       : 'INTEGER PRIMARY KEY',
		user     : 'TEXT',
		date     : 'TIMESTAMP',
		
		body     : 'TEXT',
		imageId  : 'INTEGER',
		revision : 'TEXT',
	}
});

Tombloo.Video = Tombloo.Entity({
	name : 'videos',
	fields : {
		id     : 'INTEGER PRIMARY KEY',
		user   : 'TEXT',
		date   : 'TIMESTAMP',
		
		body   : 'TEXT',
		source : 'TEXT',
		player : 'TEXT',
	}
});

Tombloo.Link = Tombloo.Entity({
	name : 'links',
	fields   : {
		id     : 'INTEGER PRIMARY KEY',
		user   : 'TEXT',
		date   : 'TIMESTAMP',
		
		title  : 'TEXT',
		source : 'TEXT',
		body   : 'TEXT',
	}
});

Tombloo.Conversation = Tombloo.Entity({
	name : 'conversations',
	fields : {
		id    : 'INTEGER PRIMARY KEY',
		user  : 'TEXT',
		date  : 'TIMESTAMP',
		
		title : 'TEXT',
		body  : 'TEXT',
	}
});

Tombloo.Quote = Tombloo.Entity({
	name : 'quotes',
	fields : {
		id     : 'INTEGER PRIMARY KEY',
		user   : 'TEXT',
		date   : 'TIMESTAMP',
		
		body   : 'TEXT',
		source : 'TEXT',
	}
});


extend(Tombloo.Photo.prototype, {
	get_url : function(){
		return 'http://' + this.user + '.tumblr.com/post/' + this.id;
	},
	set_url : function(){
	},
	checkFile : function(size){
		return this.getFile(size).exists();
	},
	getFile : function(size){
		var file = Tombloo.Photo.getPhotoDir(size);
		file.append(this.getFileName(size));
		return file;
	},
	getFileName : function(size){
		return this.imageId + '_' + (this.revision? this.revision + '_' : '') + size + (size==75? 'sq' : '') + '.jpg';
	},
});

extend(Tombloo.Photo, {
	findUsers : function(){
		return Tombloo.Photo.find('SELECT user FROM photos GROUP BY user ORDER BY user').map(itemgetter('user'));
	},
	getPhotoDir : function(size){
		var dir = Tombloo.root;
		with(dir){
			append('photo');
			if(size)
				append(size);
			
			if(!exists())
				create(DIRECTORY_TYPE, 0666);
		}
		return dir;
	},
	getFiles : function(size){
		return this.getPhotoDir(size).directoryEntries;
	},
	getImageInfo : function(file){
		file = file.split('/').pop();
		
		var ts = file.split(/[_\.]/);
		if(ts.length==3)
			ts.splice(1, 0, null);
		return {
			id : ts[0],
			revision : ts[1],
			size : ts[2],
			extension : ts[3],
		}
	},
});

Tombloo.Post = Tombloo.Entity({name : 'posts'});
extend(Tombloo.Post, {
	insert : function(post){
		Tombloo[capitalize(post.type)].insert(post);
	},
	rowToObject : function(obj){
		var Clazz = Tombloo[capitalize(obj.type)];
		var model = new Clazz(obj);
		model.temporary = false;
		return model;
	},
	initialize : function(){
		try{
			return this.db.execute(<>
				CREATE VIEW posts AS 
				SELECT "regular" AS type, id, user, date, 
					title, 
					body, 
					"" AS source, 
					"" AS player, 
					"" AS imageId, "" AS revision
				FROM regulars 
				UNION ALL 
				SELECT "photo" AS type, id, user, date, 
					"" AS title, 
					body, 
					"" AS source, 
					"" AS player, 
					imageId, 
					revision
				FROM photos 
				UNION ALL 
				SELECT "video" AS type, id, user, date, 
					"" AS title, 
					body, 
					source, 
					player, 
					"" AS imageId, "" AS revision
				FROM videos 
				UNION ALL 
				SELECT "link" AS type, id, user, date, 
					title, 
					body, 
					source, 
					"" AS player, 
					"" AS imageId, "" AS revision
				FROM links 
				UNION ALL 
				SELECT "conversation" AS type, id, user, date, 
					title, 
					body, 
					"" AS source, 
					"" AS player, 
					"" AS imageId, "" AS revision
				FROM conversations 
				UNION ALL 
				SELECT "quote" AS type, id, user, date, 
					"" AS title, 
					body, 
					source, 
					"" AS player, 
					"" AS imageId, "" AS revision
				FROM quotes 
			</>);
		} catch(e if e instanceof Database.AlreadyExistsException){}
	},
});