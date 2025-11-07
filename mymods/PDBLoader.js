import {
	BufferGeometry,
	FileLoader,
	Float32BufferAttribute,
	Loader,
	Color,
	SRGBColorSpace
} from 'three';

class PDBLoader extends Loader { // PDBLoader class extends Loader class from three.js
	
	constructor( manager ) {
		super( manager );

	}
	

	load( input, onLoad, onProgress, onError ) {
		const scope = this;

		//Detect whether the input is a  URL or raw text
		const isTextInput = typeof input === 'string' && (input.includes('\n') || input.includes('ATOM'));

		if (isTextInput) {
        	// ----------------------------------------------------------
        	// CASE 1: input is already raw PDB text (e.g. from FileReader)
        	// ----------------------------------------------------------
        	try {
            	const result = scope.parse(input);
            	if (onLoad) onLoad(result);
        	} catch (e) {
            	if (onError) onError(e);
            	else console.error(e);
        	}
        	return; // stop here — don’t use FileLoader
    	}

		// ----------------------------------------------------------
    	// CASE 2: input is a URL/path (default behavior)
    	// ----------------------------------------------------------
    	const loader = new FileLoader(scope.manager);
    	loader.setPath(scope.path);
    	loader.setRequestHeader(scope.requestHeader);
    	loader.setWithCredentials(scope.withCredentials);

    	loader.load(input, function (text) {
        	try {
            	onLoad(scope.parse(text));
        	} catch (e) {
            	if (onError) onError(e);
            	else console.error(e);
            	scope.manager.itemError(input);
        	}
    	}, onProgress, onError);

	}

	// Based on CanvasMol PDB parser

	parse( text ) { // processes raw PDB file text
		// the following three functions are for string formatting and hashing
		function trim( text ) {
			return text.replace( /^\s\s*/, '' ).replace( /\s\s*$/, '' );
		}

		function capitalize( text ) {
			return text.charAt( 0 ).toUpperCase() + text.slice( 1 ).toLowerCase();
		}

		function hash( s, e ) {
			return 's' + Math.min( s, e ) + 'e' + Math.max( s, e );
		}

		// processes bond connections using line slices
		function parseBond( start, length, satom, i ) {

			const eatom = parseInt( lines[ i ].slice( start, start + length ) );

			if ( eatom ) {

				const h = hash( satom, eatom );

				if ( _bhash_conect[ h ] === undefined ) {

					_bonds_conect.push( [ satom - 1, eatom - 1, 1 ] );
					_bhash_conect[ h ] = _bonds_conect.length - 1;

					let bondData = [ satom, eatom ];

					bonds_conect.push( bondData );

				} else {

					// doesn't really work as almost all PDBs
					// have just normal bonds appearing multiple
					// times instead of being double/triple bonds
					// bonds[bhash[h]][2] += 1;

				}

			}

		}

		function calculate_distance(x1, y1, z1, x2, y2, z2) { // TODO might move location? 
			//console.log(x1, y1, z1, x2, y2, z2);
			return ((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2)**(1/2);
		}

		function isBond(atom1, atom2, distance) {
			var bond = false;
			var double_bond = false;
			var triple_bond = false;
			var threshold = .07;

			var atomList = [atom1, atom2];
			atomList = atomList.sort();
			atom1 = atomList[0];
			atom2 = atomList[1];

			if(atom1 == "Br")
			{
				if(atom2 == "Br")
				{
					if(Math.abs(distance - 2.34) < threshold)
						{ bond = true; }
				}

				if(atom2 == "H")
				{
					if(Math.abs(distance - 1.43) < threshold)
						{ bond = true; }
				}
			} 

			if(atom1 == "C")
			{
				if(atom2 == "C")
				{
					if(Math.abs(distance - 1.53) < threshold)
					{ bond = true; }

					if(Math.abs(distance - 1.39) < threshold) // where is this from? in scout's code
						{ bond = true; }

					if(Math.abs(distance - 1.33) < threshold) // double bond?
					{ bond = true; double_bond = true; }

					if(Math.abs(distance - 1.21) < threshold)
					{ bond = true; triple_bond = true; }
				}

				if(atom2 == "Cl")
				{
					if(Math.abs(distance - 1.80) < threshold)
						{ bond = true; }
				}

				if(atom2 == "F")
				{
					if(Math.abs(distance - 1.38) < threshold)
						{ bond = true; }
				}

				if(atom2 == "H")
				{
					if(Math.abs(distance - 1.10) < threshold)
						{ bond = true; }
				}

				if(atom2 == "N")
				{
					if(Math.abs(distance - 1.46) < threshold) 
						{ bond = true; }

					if(Math.abs(distance - 1.38) < threshold) // where is this coming from? i think necessary
						{ bond = true; } 

					if(Math.abs(distance - 1.27) < threshold)
						{ bond = true; double_bond = true; }

					if(Math.abs(distance - 1.16) < threshold)
						{ bond = true; triple_bond = true; }
				}    

				if(atom2 == "O")
				{
					if(Math.abs(distance - 1.42) < threshold)
						{ bond = true; }

					if(Math.abs(distance - 1.20) < threshold)
						{ bond = true; double_bond = true; }

					if(Math.abs(distance - 1.14) < threshold)
						{ bond = true; triple_bond = true; }
				}

				if(atom2 == "S") 
				{
					if(Math.abs(distance - 1.84) < threshold)
						{ bond = true; }
				}
			}  

			if(atom1 == "Cl")
			{
				if(atom2 == "Cl")
				{
					if(Math.abs(distance - 2.05) < threshold)
						{ bond = true; }
				}
				if(atom2 == "H")
				{
					if(Math.abs(distance - 1.30) < threshold)
						{ bond = true; }
				}
			} 
			if(atom1 == 'F'){
				if(atom2 == "F")
				{
					if(Math.abs(distance - 1.41) < threshold)
						{ bond = true; }
				}
				if(atom2 == "H")
				{
					if(Math.abs(distance - 0.93) < threshold)
						{ bond = true; }
				}
			}

			if(atom1 == "H")
			{
				if(atom2 == "H")
				{
					if(Math.abs(distance - 0.76) < threshold)
						{ bond = true; }
				}
				if(atom2 == "N")
				{
					if(Math.abs(distance - 1.03) < threshold)
						{ bond = true; }
				}
				if(atom2 == "O")
				{
					if(Math.abs(distance - 0.97) < threshold)
						{ bond = true; }
				}
				if(atom2 == "S")
				{
					if(Math.abs(distance - 1.36) < threshold)
						{ bond = true; }
				}
			}

			if(atom1 == "N")
			{
				if(atom2 == "N")
				{
					if(Math.abs(distance - 1.44) < threshold)
						{ bond = true; }
					
					if(Math.abs(distance - 1.24) < threshold)
						{ bond = true; double_bond = true;}

					if(Math.abs(distance - 1.17) < threshold)
						{ bond = true; triple_bond = true;}
				}    

				if(atom2 == "O")
				{
					if(Math.abs(distance - 1.43) < threshold)
						{ bond = true; }

					if(Math.abs(distance - 1.20) < threshold)
						{ bond = true; double_bond = true; }

					if(Math.abs(distance - 1.06) < threshold) // this is a guess for triple bond, can't find
						{ bond = true; triple_bond = true; }
				}
			}

			if(atom1 == "O")
			{
				if(atom2 == "O")
				{
					if(Math.abs(distance - 1.46) < threshold)
						{ bond = true; }

					if(Math.abs(distance - 1.21) < threshold) // this is a guess for double bond, can't find
						{ bond = true; double_bond = true; }
				} 

				if(atom2 == "S")
				{
					if(Math.abs(distance - 1.73) < threshold)
						{ bond = true; }
				} 
			}

			return [bond, double_bond, triple_bond]; 
		}

		function buildGeometry() {

			const build = {
				geometryAtoms: new BufferGeometry(),
				geometryBondsManual: new BufferGeometry(),
				geometryBondsConect: new BufferGeometry(),
				json_atoms: {
					atoms: atoms
				},
				json_bonds_manual: {
					bonds_manual: bonds_manual
				},
				json_bonds_conect: {
					bonds_conect: bonds_conect
				},
				residues: residues,
				chains: chains
			};
			//console.log('atoms', atoms);


			const geometryAtoms = build.geometryAtoms;
			const geometryBondsManual = build.geometryBondsManual;
			const geometryBondsConect = build.geometryBondsConect;

			const verticesAtoms = [];
			const colorsAtoms = [];

			const verticesBondsManual = [];
			const verticesBondsConect = [];

			/* const atomsInBondsManual = [];
			const atomsInBondsConect = []; */


			// atoms
			//console.log('atoms', atoms);

			const c = new Color();

			for ( let i = 0, l = atoms.length; i < l; i ++ ) {

				let atom1 = atoms[ i ];

				let x = atom1[ 0 ];
				let y = atom1[ 1 ];
				let z = atom1[ 2 ];

				verticesAtoms.push( x, y, z );

				let r = atom1[ 3 ][ 0 ] / 255;
				let g = atom1[ 3 ][ 1 ] / 255;
				let b = atom1[ 3 ][ 2 ] / 255;
				//console.log(atom1[3], atom1);

				c.setRGB( r, g, b, SRGBColorSpace );

				colorsAtoms.push( c.r, c.g, c.b );


				// check for manual bonds

                for ( let j = i+1; j < atoms.length; j += 1 ) {
                    //getting the content of atom 1 and atom 2 
                    let atom2 = atoms[j]; 

					let bondData = [ i+1, j+1 ];

                    let start1_x = atom1[0]; 
                    let start1_y = atom1[1]; 
                	let start1_z = atom1[2]; 
        
                    let start2_x = atom2[0]; 
                    let start2_y = atom2[1]; 
                    let start2_z = atom2[2]; 

                    // so we can get the distance between them and see if that distance 
                    // matches the bond distance between their corresponding atom types 
					// (using isBond method -- later in code)
                    var distance = calculate_distance(start1_x, start1_y, start1_z, start2_x, start2_y, start2_z);
                    var isbond = isBond(atom1[4], atom2[4], distance);
					var is_singlebond = isbond[0];
					var is_doublebond = isbond[1];
					var is_triplebond = isbond[2];

                    
                    // if we have found a bond, then we add to _bonds_manual and _bhash_manual
                    if(is_singlebond){
						const h = hash( i, j );
			
						if ( _bhash_manual[ h ] === undefined ) {
		
							_bonds_manual.push( [ i, j, 1 ] );
							_bhash_manual[ h ] = _bonds_manual.length - 1; 

							verticesBondsManual.push( start1_x, start1_y, start1_z );
							verticesBondsManual.push( start2_x, start2_y, start2_z );

							bonds_manual.push( bondData );
			
						}
                    }
				}

			}

			//console.log("atomsInBondsManual", atomsInBondsManual);

			// bonds, conect 

			// TODO, don't need this if bonds_conect works
			for ( let i = 0, l = _bonds_conect.length; i < l; i ++ ) {

				const bond = _bonds_conect[ i ];

				const start = bond[ 0 ];
				const end = bond[ 1 ];

				const startAtom = _atomMap[ start ];
				const endAtom = _atomMap[ end ];

				let x = startAtom[ 0 ];
				let y = startAtom[ 1 ];
				let z = startAtom[ 2 ];

				verticesBondsConect.push( x, y, z );
				//console.log("old start coordinates in PDBloader: ", x, y, z);
				//atomsInBondsConect.push(startAtom, endAtom);

				x = endAtom[ 0 ];
				y = endAtom[ 1 ];
				z = endAtom[ 2 ];

				//console.log("old end coordinates in PDBloader: ", x, y, z);
				verticesBondsConect.push( x, y, z );

			}


			// build geometry

			geometryAtoms.setAttribute( 'position', new Float32BufferAttribute( verticesAtoms, 3 ) );
			geometryAtoms.setAttribute( 'color', new Float32BufferAttribute( colorsAtoms, 3 ) );

			geometryBondsConect.setAttribute( 'position', new Float32BufferAttribute( verticesBondsConect, 3 ) );
			geometryBondsManual.setAttribute( 'position', new Float32BufferAttribute( verticesBondsManual, 3 ) );

			//console.log("geometryBondsManual.attributes.position.array: ", geometryBondsManual.attributes.position.array);

			return build;

		}

		// Atom colors based on VMD CPK coloring
		const CPK = { h: [ 255, 255, 255 ], 
					he: [ 217, 255, 255 ], 
					li: [ 204, 128, 255 ], 
					be: [ 194, 255, 0 ], 
					b: [ 255, 181, 181 ], 
					c: [ 0, 255, 255 ], 
					n: [ 0, 0, 255 ], 
					o: [ 255, 0, 0 ], 
					f: [ 209, 139, 141 ], 
					ne: [ 179, 227, 245 ], 
					na: [ 171, 92, 242 ], 
					mg: [ 138, 255, 0 ], 
					al: [ 191, 166, 166 ], 
					si: [ 240, 200, 160 ], 
					p: [ 255, 128, 0 ], 
					s: [ 255, 255, 0 ], 
					cl: [ 31, 240, 31 ], 
					ar: [ 128, 209, 227 ], 
					k: [ 143, 64, 212 ], 
					ca: [ 61, 255, 0 ], 
					sc: [ 230, 230, 230 ], 
					ti: [ 191, 194, 199 ], 
					v: [ 166, 166, 171 ], 
					cr: [ 138, 153, 199 ], 
					mn: [ 156, 122, 199 ], 
					fe: [ 224, 102, 51 ], 
					co: [ 240, 144, 160 ], 
					ni: [ 80, 208, 80 ], 
					cu: [ 200, 128, 51 ], 
					zn: [ 125, 128, 176 ], 
					ga: [ 194, 143, 143 ], 
					ge: [ 102, 143, 143 ], 
					as: [ 189, 128, 227 ], 
					se: [ 255, 161, 0 ], 
					br: [ 166, 41, 41 ], 
					kr: [ 92, 184, 209 ], 
					rb: [ 112, 46, 176 ], 
					sr: [ 0, 255, 0 ], 
					y: [ 148, 255, 255 ], 
					zr: [ 148, 224, 224 ], 
					nb: [ 115, 194, 201 ], 
					mo: [ 84, 181, 181 ], 
					tc: [ 59, 158, 158 ], 
					ru: [ 36, 143, 143 ], 
					rh: [ 10, 125, 140 ], 
					pd: [ 0, 105, 133 ], 
					ag: [ 192, 192, 192 ], 
					cd: [ 255, 217, 143 ], 
					in: [ 166, 117, 115 ], 
					sn: [ 102, 128, 128 ], 
					sb: [ 158, 99, 181 ], 
					te: [ 212, 122, 0 ], 
					i: [ 148, 0, 148 ], 
					xe: [ 66, 158, 176 ], 
					cs: [ 87, 23, 143 ], 
					ba: [ 0, 201, 0 ], 
					la: [ 112, 212, 255 ], 
					ce: [ 255, 255, 199 ], 
					pr: [ 217, 255, 199 ], 
					nd: [ 199, 255, 199 ], 
					pm: [ 163, 255, 199 ], 
					sm: [ 143, 255, 199 ], 
					eu: [ 97, 255, 199 ], 
					gd: [ 69, 255, 199 ], 
					tb: [ 48, 255, 199 ], 
					dy: [ 31, 255, 199 ], 
					ho: [ 0, 255, 156 ], 
					er: [ 0, 230, 117 ], 
					tm: [ 0, 212, 82 ], 
					yb: [ 0, 191, 56 ], 
					lu: [ 0, 171, 36 ], 
					hf: [ 77, 194, 255 ], 
					ta: [ 77, 166, 255 ], 
					w: [ 33, 148, 214 ], 
					re: [ 38, 125, 171 ], 
					os: [ 38, 102, 150 ], 
					ir: [ 23, 84, 135 ], 
					pt: [ 208, 208, 224 ], 
					au: [ 255, 209, 35 ], 
					hg: [ 184, 184, 208 ], 
					tl: [ 166, 84, 77 ], 
					pb: [ 87, 89, 97 ], 
					bi: [ 158, 79, 181 ], 
					po: [ 171, 92, 0 ], 
					at: [ 117, 79, 69 ], 
					rn: [ 66, 130, 150 ], 
					fr: [ 66, 0, 102 ], 
					ra: [ 0, 125, 0 ], 
					ac: [ 112, 171, 250 ], 
					th: [ 0, 186, 255 ], 
					pa: [ 0, 161, 255 ], 
					u: [ 0, 143, 255 ], 
					np: [ 0, 128, 255 ], 
					pu: [ 0, 107, 255 ], 
					am: [ 84, 92, 242 ], 
					cm: [ 120, 92, 227 ], 
					bk: [ 138, 79, 227 ], 
					cf: [ 161, 54, 212 ], 
					es: [ 179, 31, 212 ], 
					fm: [ 179, 31, 186 ], 
					md: [ 179, 13, 166 ], 
					no: [ 189, 13, 135 ], 
					lr: [ 199, 0, 102 ], 
					rf: [ 204, 0, 89 ], 
					db: [ 209, 0, 79 ], 
					sg: [ 217, 0, 69 ], 
					bh: [ 224, 0, 56 ], 
					hs: [ 230, 0, 46 ], 
					mt: [ 235, 0, 38 ], 
					ds: [ 235, 0, 38 ], 
					rg: [ 235, 0, 38 ], 
					cn: [ 235, 0, 38 ], 
					uut: [ 235, 0, 38 ], 
					uuq: [ 235, 0, 38 ], 
					uup: [ 235, 0, 38 ], 
					uuh: [ 235, 0, 38 ], 
					uus: [ 235, 0, 38 ], 
					uuo: [ 235, 0, 38 ] };

		const atoms = [];
		const residues = [];
		const chains = [];
		const bonds_manual = [];
		const bonds_conect = [];

		const _bonds_conect = [];
		const _bonds_manual = [];
		const _bhash_manual = {};
		const _bhash_conect = {};
		const _atomMap = {};

		// parse
		let conect_exists = false;

		const lines = text.split( '\n' );

		for ( let i = 0, l = lines.length; i < l; i ++ ) {

			if ( lines[ i ].slice( 0, 4 ) === 'ATOM' || lines[ i ].slice( 0, 6 ) === 'HETATM' ) {

				const x = parseFloat( lines[ i ].slice( 30, 37 ) );
				const y = parseFloat( lines[ i ].slice( 38, 45 ) );
				const z = parseFloat( lines[ i ].slice( 46, 53 ) );
				const index = parseInt( lines[ i ].slice( 6, 11 ) ) - 1;
				const resid = parseInt( lines[ i ].slice( 23, 27) ); // TODO refine these numbers
				const chain = trim( lines[ i ].slice( 21, 22 ) );
				const resName = trim( lines[ i ].slice ( 17, 20 ));

				// 0         1         2         3         4
				// 0123456789012345678901234567890123456789012345678901234567890123456789
				// ATOM   4552 OCT2 GLY A 284      -2.134   3.325 -15.436  1.00 -0.57
				// ATOM   4553  N1  DRG D 285      16.230  -9.906   7.916  1.00 -0.60

				let e = trim( lines[ i ].slice( 76, 78 ) ).toLowerCase();

				if (e == '') { // sometimes the PDB file doesn't contain a final column for atom identity, in which case use third column
					e = trim( lines[ i ].slice( 12, 16 ) ).toLowerCase(); 
				}
				
				let elem = e[0] // grab the first letter of e only, e.g. "h" from "hd21" - this is the element

				const atomData = [ x, y, z, CPK[ elem ], capitalize( elem ), resid, chain, e, resName];
				// DRG285:F34
				// resName + resid + ':' + e
				// atomData[8] + atomData[5] + ':' + atomData[7]
				// console.log(atomData);

				if (!residues[resid]) { // creates an array of unique residue numbers present in PDB file
					residues[resid] = true; // mark residue as seen
				} // might change this system to match chains below

				if (!chains.includes(chain)) { // creates an array of unique chains present in PDB file
					chains.push(chain); // mark chain as seen
				}

				atoms.push( atomData );
				_atomMap[ index ] = atomData;

			} else if ( lines[ i ].slice( 0, 6 ) === 'CONECT' ) {
				conect_exists = true;

				const satom = parseInt( lines[ i ].slice( 6, 11 ) ); // start atom serial number

				parseBond( 11, 5, satom, i ); // start index, length of field, satom, line index
				parseBond( 16, 5, satom, i );
				parseBond( 21, 5, satom, i );
				parseBond( 26, 5, satom, i );

			}

		}
		
		// build and return geometry
		return buildGeometry();

	}

}

export { PDBLoader };
