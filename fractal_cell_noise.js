/* 
--------------------------------------------------------------------------------

octavia noise

--------------------------------------------------------------------------------

this is the heart of the cellular noise algorithm. it's a single x, y lookup. the noise loops on itself, and is a rectangle xsize by ysize. x and y are the current point in space we are calculating for (floating point is fine). the space is divided into squares. n points are deterministically placed             
+---------+ in the square ("samples" controls this). each is given a random 
|   x     | height, by default -1 to 1. a soft 0-1 kernel is centered on each. 
|         | it has a diameter equal to the square size, outside of which it 
|x     x  | falls off cleanly to 0. 
|  x      | 
+---------+ d is density- at density 1 you have 1 square for the entire texture space. at density 2 it's 2 squares by 2, etc.. seed is the seed for this octave. softness alters the shape of the falloff (but it always has the same diameter). the heights can be customized customized by setting the bias value (center) and range (it goes from bias - range to bias + range)   */

// this variant uses a trick to reduce samples
// sample radius is 1/2 square edge instead of 1, which makes overlap from neighboring cells never more than 1/2 square length. this means we can check which quadrant we're in and only check the three nearest neighbors, instead of all 8 neighbors.
function curve_stack_2x2_xy(x, y, xsize = 256, ysize = 256, d = 1, seed = 0, softness = 1, samples = 4, bias = 0, range = 1 ) {

    x /= xsize; y /= xsize 
    let ix = Math.floor(x * d); let iy = Math.floor(y * d)
    let ti = 0 // random number table index

    c_height = 0

    let left = ix - 1 + Math.floor(x * 2 * d) % 2
    let top = iy - 1 + Math.floor(y * 2 * d) % 2
    let right = left + 1; let bottom = top + 1

    // this uses every point within the radius. when doing worley noise, we calculate distances for each point, and compare, getting various other parameters per point. instead, we can drop the distance comparisons, and instead get a height per point and run it through a lightweight kernel, and accumulate
    for (let cy = top; cy <= bottom; cy ++) {
        for (let cx = left; cx <= right; cx ++) {
            // this is a deterministic noise function with two integer inputs
            ti = pos3int((cx + d) % d, (cy + d) % d, noise_seed)
            // seed our rng with that value
        
            let count = samples
            // this bounded curve runs from -1 to 1. i believe this means that we want to multiply the distance by d. however, this seems to leave seams? maybe i am wrong about the numbers.
            for (let a = 0; a < count; a ++) {
                let px = cx / d + (noise_table[(ti ++) % nt_size] / nt_size) / d
                let py = cy / d + (noise_table[(ti ++) % nt_size] / nt_size) / d
                let distance = d * Math.sqrt((x - px) ** 2 + (y - py) ** 2) * 2
                let height = bias + -range + 2 * range * noise_table[(ti ++) % nt_size] / nt_size
                // this is a bounded -1 to 1 variant of the witch of agnesi. this will prevent seams when points drop out of the set.
                if (distance < 1.0) {
                    let a = (softness * (1 - distance * distance) 
                            / (softness + distance * distance))
                    a = a * a
                    // note that this worked ^ 2, but the derivative was not 0 at -1 and 1
                    c_height += height * a
                }
            }
        }
    }

    return c_height
}


function curve_stack_3x3_xy(x, y, xsize = 256, ysize = 256, d = 1, seed = 0, softness = 1, samples = 4, bias = 0, range = 1 ) {

    x /= xsize; y /= xsize 
    let ix = Math.floor(x * d); let iy = Math.floor(y * d)
    let ti = 0 // random number table index

    c_height = 0

    // this uses every point within the radius. when doing worley noise, we calculate distances for each point, and compare, getting various other parameters per point. instead, we can drop the distance comparisons, and instead get a height per point and run it through a lightweight kernel, and accumulate
    for (let oy = -1; oy <= 1; oy ++) {
        for (let ox = -1; ox <= 1; ox ++) {
            let cx = ix + ox; let cy = iy + oy
            // this is a deterministic noise function with two integer inputs
            ti = pos3int((cx + d) % d, (cy + d) % d, noise_seed)
            // seed our rng with that value
        
            // let count = 1 + prime_cycle() % (samples - 1)
            let count = samples
            // this bounded curve runs from -1 to 1. i believe this means that we want to multiply the distance by d. however, this seems to leave seams? maybe i am wrong about the numbers.
            for (let a = 0; a < count; a ++) {
                let px = cx / d + (noise_table[(ti ++) % nt_size] / nt_size) / d 
                let py = cy / d + (noise_table[(ti ++) % nt_size] / nt_size) / d
                let distance = d * Math.sqrt((x - px) ** 2 + (y - py) ** 2) 
                let height = bias + -range + 2 * range * noise_table[(ti ++) % nt_size] / nt_size
                // this is a bounded -1 to 1 variant of the witch of agnesi. this will prevent seams when points drop out of the set.
                if (distance < 1.0) {
                    let a = (softness * (1 - distance * distance) 
                            / (softness + distance * distance))
                    a = a * a
                    // note that this worked ^ 2, but the derivative was not 0 at -1 and 1
                    c_height += height * a
                }
            }
        }
    }

    return c_height
}


var stack_octaves = 1
function cell_noise_xy(x, y, xsize = 256, ysize = 256, density = 4, seed = 0,octaves = 2, amplitude_ratio = 1/2, softness = 1, samples = 4, bias = 0, range = 1 ) {
    let surface = 0
    for (let a = 0; a < octaves; a ++) {
        let octave_seed = noise_table[seed % nt_size] // inline prime cycle
        seed += pc_increment
        let layer = curve_stack_2x2_xy(x, y, xsize, ysize, density * 2 ** a, octave_seed, softness, samples, bias, range)

        surface += (amplitude_ratio ** a) * layer
    }

    c_height = 0.5 * surface
    return c_height
}
/* this evaluates as -1 to 1, very center-weighted
(seed 29477)
-1.0 - -0.9  ▓▓
-0.9 - -0.8  ▓▓
-0.8 - -0.7  ▓▓▓
-0.7 - -0.6  ▓▓▓▓▓
-0.6 - -0.5  ▓▓▓▓▓▓▓
-0.5 - -0.4  ▓▓▓▓▓▓▓▓
-0.4 - -0.3  ▓▓▓▓▓▓▓▓▓▓
-0.3 - -0.2  ▓▓▓▓▓▓▓▓▓▓▓▓▓
-0.2 - -0.1  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
-0.1 -  0.0  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 0.0 -  0.1  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 0.1 -  0.2  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 0.2 -  0.3  ▓▓▓▓▓▓▓▓▓▓▓▓
 0.3 -  0.4  ▓▓▓▓▓▓▓▓▓▓
 0.4 -  0.5  ▓▓▓▓▓▓▓▓▓
 0.5 -  0.6  ▓▓▓▓▓▓▓
 0.6 -  0.7  ▓▓▓▓▓
 0.7 -  0.8  ▓▓▓▓
 0.8 -  0.9  ▓▓▓
 0.9 -  1.0  ▓▓▓
*/


/* 
--------------------------------------------------------------------------------

positional random number generation

--------------------------------------------------------------------------------
for 2d value noise, we need to be able to input two coordinates and a seed, and
get a deterministic value for that point in space. you can substitute other
approaches for this one- this is a relatively simple, readable approach i came
up with but there are more cryptographically sound 3 input hashes out there.

note that if generalizing this for n dimensions, you'd want your number of dimensions plus one for the seed
*/

// three input positional rng. the output is an integer in the range 0-nt_size
function pos3int(x, y, seed) {
    let linear = (x % ns) + (y % ns) * ns + seed
    linear %= noise_table.length
    return noise_table[linear]
}


// used for table setup only
var seed = 88883
var noise_table = []
var ns = 256
var nt_size = ns * ns
function init_random_table() {
    let list = []
    for (let a = 0; a < nt_size; a ++) {
        list.push(a)
    }
    for (let a = 0; a < nt_size; a ++) {
        noise_table[a] = draw_card(list)
    }
}


// if you walk through a table, offsetting your index by a prime number which doesn't divide evenly into your table size, you will cycle through all the entries in the array exactly once, in a nonrepeating order. 
// there are three instances of this in the algorithm, all inline, but this self-contained function is here for clarity
var pc_increment = 101159
var pc_seed = 0
function prime_cycle() {
    let result = noise_table[pc_seed % nt_size]
    pc_seed += pc_increment
    return result
}


// used for table setup only
// picks a random element and returns it, removing it from the array
function draw_card(array) {
    var index = Math.floor(Math.random() * array.length);
    //console.log("index = " + index);
    var result = array[index];
    if (array.length > 0) {
        return (array.splice(index, 1))[0];
    }
    else
        return "ERROR: pick running on array of size 0";
}