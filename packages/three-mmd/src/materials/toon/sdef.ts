/* eslint-disable ts/unbound-method */

import type { Material } from 'three'

import { REVISION } from 'three'

const sdefDeclaration = /* glsl */`
#if MMD_USE_SDEF
#ifdef USE_SKINNING
attribute float mmdSdefMask;
attribute vec3 mmdSdefC;
attribute vec3 mmdSdefRW0;
attribute vec3 mmdSdefRW1;

vec4 mmdRotationMatrixToQuaternion( mat3 matrix ) {
  float trace = matrix[ 0 ][ 0 ] + matrix[ 1 ][ 1 ] + matrix[ 2 ][ 2 ];
  if ( trace > 0.0 ) {
    float s = 0.5 / sqrt( trace + 1.0 );
    return vec4( ( matrix[ 1 ][ 2 ] - matrix[ 2 ][ 1 ] ) * s, ( matrix[ 2 ][ 0 ] - matrix[ 0 ][ 2 ] ) * s, ( matrix[ 0 ][ 1 ] - matrix[ 1 ][ 0 ] ) * s, 0.25 / s );
  }
  if ( matrix[ 0 ][ 0 ] > matrix[ 1 ][ 1 ] && matrix[ 0 ][ 0 ] > matrix[ 2 ][ 2 ] ) {
    float s = 2.0 * sqrt( 1.0 + matrix[ 0 ][ 0 ] - matrix[ 1 ][ 1 ] - matrix[ 2 ][ 2 ] );
    return vec4( 0.25 * s, ( matrix[ 0 ][ 1 ] + matrix[ 1 ][ 0 ] ) / s, ( matrix[ 2 ][ 0 ] + matrix[ 0 ][ 2 ] ) / s, ( matrix[ 1 ][ 2 ] - matrix[ 2 ][ 1 ] ) / s );
  }
  if ( matrix[ 1 ][ 1 ] > matrix[ 2 ][ 2 ] ) {
    float s = 2.0 * sqrt( 1.0 + matrix[ 1 ][ 1 ] - matrix[ 0 ][ 0 ] - matrix[ 2 ][ 2 ] );
    return vec4( ( matrix[ 0 ][ 1 ] + matrix[ 1 ][ 0 ] ) / s, 0.25 * s, ( matrix[ 1 ][ 2 ] + matrix[ 2 ][ 1 ] ) / s, ( matrix[ 2 ][ 0 ] - matrix[ 0 ][ 2 ] ) / s );
  }
  float s = 2.0 * sqrt( 1.0 + matrix[ 2 ][ 2 ] - matrix[ 0 ][ 0 ] - matrix[ 1 ][ 1 ] );
  return vec4( ( matrix[ 2 ][ 0 ] + matrix[ 0 ][ 2 ] ) / s, ( matrix[ 1 ][ 2 ] + matrix[ 2 ][ 1 ] ) / s, 0.25 * s, ( matrix[ 0 ][ 1 ] - matrix[ 1 ][ 0 ] ) / s );
}

mat3 mmdQuaternionToRotationMatrix( vec4 q ) {
  float xx = q.x * q.x; float yy = q.y * q.y; float zz = q.z * q.z;
  float xy = q.x * q.y; float zw = q.z * q.w; float zx = q.z * q.x;
  float yw = q.y * q.w; float yz = q.y * q.z; float xw = q.x * q.w;
  return mat3( 1.0 - 2.0 * ( yy + zz ), 2.0 * ( xy + zw ), 2.0 * ( zx - yw ), 2.0 * ( xy - zw ), 1.0 - 2.0 * ( zz + xx ), 2.0 * ( yz + xw ), 2.0 * ( zx + yw ), 2.0 * ( yz - xw ), 1.0 - 2.0 * ( yy + xx ) );
}

vec4 mmdSlerp( vec4 q0, vec4 q1, float t ) {
  float cosTheta = dot( q0, q1 );
  q1 = mix( -q1, q1, step( 0.0, cosTheta ) );
  cosTheta = abs( cosTheta );
  if ( cosTheta > 0.999999 ) return normalize( mix( q0, q1, t ) );
  float theta = acos( cosTheta );
  float sinTheta = sin( theta );
  return q0 * sin( ( 1.0 - t ) * theta ) / sinTheta + q1 * sin( t * theta ) / sinTheta;
}
#endif
#endif
`

const skinningVertex = /* glsl */`
#ifdef USE_SKINNING
  vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
  vec4 skinned = vec4( 0.0 );
  skinned += boneMatX * skinVertex * skinWeight.x;
  skinned += boneMatY * skinVertex * skinWeight.y;
  skinned += boneMatZ * skinVertex * skinWeight.z;
  skinned += boneMatW * skinVertex * skinWeight.w;
  vec3 linearTransformed = ( bindMatrixInverse * skinned ).xyz;

  mat4 mmdBone0 = bindMatrixInverse * boneMatX * bindMatrix;
  mat4 mmdBone1 = bindMatrixInverse * boneMatY * bindMatrix;
  mat3 mmdRotation = mmdQuaternionToRotationMatrix( mmdSlerp( mmdRotationMatrixToQuaternion( mat3( mmdBone0 ) ), mmdRotationMatrixToQuaternion( mat3( mmdBone1 ) ), skinWeight.y ) );
  vec3 mmdOffset = ( mmdBone0 * vec4( mmdSdefRW0, 1.0 ) ).xyz * skinWeight.x + ( mmdBone1 * vec4( mmdSdefRW1, 1.0 ) ).xyz * skinWeight.y;
  vec3 sdefTransformed = mmdRotation * ( transformed - mmdSdefC ) + mmdOffset;
  transformed = mix( linearTransformed, sdefTransformed, mmdSdefMask );
#endif
`

const skinNormalVertex = /* glsl */`
#ifdef USE_SKINNING
  mat4 skinMatrix = mat4( 0.0 );
  skinMatrix += skinWeight.x * boneMatX;
  skinMatrix += skinWeight.y * boneMatY;
  skinMatrix += skinWeight.z * boneMatZ;
  skinMatrix += skinWeight.w * boneMatW;
  skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
  vec3 linearNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
  mat4 mmdNormalBone0 = bindMatrixInverse * boneMatX * bindMatrix;
  mat4 mmdNormalBone1 = bindMatrixInverse * boneMatY * bindMatrix;
  mat3 mmdNormalRotation = mmdQuaternionToRotationMatrix( mmdSlerp( mmdRotationMatrixToQuaternion( mat3( mmdNormalBone0 ) ), mmdRotationMatrixToQuaternion( mat3( mmdNormalBone1 ) ), skinWeight.y ) );
  objectNormal = mix( linearNormal, mmdNormalRotation * objectNormal, mmdSdefMask );
  #ifdef USE_TANGENT
    objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
  #endif
#endif
`

const assertAndReplace = (source: string, expected: string, replacement: string, label: string): string => {
  if (!source.includes(expected))
    throw new Error(`MMD material shader patch failed: missing ${label} (Three r${REVISION}).`)

  return source.replace(expected, replacement)
}

/** Applies toon-local SDEF hooks without mutating Three's global shader chunks. */
export const installSdefPatch = (material: Material): void => {
  material.defines = { ...material.defines, MMD_USE_SDEF: 1 }
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer)
    shader.vertexShader = assertAndReplace(shader.vertexShader, '#include <skinning_pars_vertex>', `#include <skinning_pars_vertex>\n${sdefDeclaration}`, 'skinning_pars_vertex')
    if (shader.vertexShader.includes('#include <skinnormal_vertex>'))
      shader.vertexShader = assertAndReplace(shader.vertexShader, '#include <skinnormal_vertex>', `#if MMD_USE_SDEF\n${skinNormalVertex}\n#else\n#include <skinnormal_vertex>\n#endif`, 'skinnormal_vertex')
    shader.vertexShader = assertAndReplace(shader.vertexShader, '#include <skinning_vertex>', `#if MMD_USE_SDEF\n${skinningVertex}\n#else\n#include <skinning_vertex>\n#endif`, 'skinning_vertex')
  }
}
