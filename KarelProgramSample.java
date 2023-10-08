/*
 * File: CheckerboardKarel.java
 * ----------------------------
 * When you finish writing it, the CheckerboardKarel class should draw
 * a checkerboard using beepers, as described in Assignment 1.  You
 * should make sure that your program works for all of the sample
 * worlds supplied in the starter folder.
 */

import stanford.karel.*;

public class KarelProgramSample extends SuperKarel {

	// You fill in this part
	
	
	private void moveToBeeper(){
		
		move();
		move();
		move();
	}
	
	private void pickAndPutBeepers(){
		int a=0;
		int b=0;
		int c=0;
		int d=0;
		int k=0;
		move();
		 while (beepersPresent()){
			 if(k==1)break;
			pickBeeper();
			a=a+1;
			
			if(noBeepersPresent()){
				move();
				while (beepersPresent()){
			
				pickBeeper();
				b=b+1;
				
				d=b+a;
					if(noBeepersPresent()){
					move();	
								for(c = 0; c<d; c++){
									putBeeper();
									}
								move();
								break;
						}
				}
			}
	}
}
	
	private void fillRoad() {
		 while (frontIsClear()) {
			 if(noBeepersPresent()){putBeeper();}
			 move();
			 if(beepersPresent()){
				 turnLeft();
				 turnLeft();
				 move();
				 turnLeft();
				 turnLeft();
				 turnLeft();
			 }
			 if(frontIsClear());
			 else turnLeft();
			 
		 }
		 putBeeper();
		 
		 
		} 

	private void pickBeepers(){
		
		for(int i=0; i<10; i++){
			pickBeeper();
		}
	}
	
	private void putBeepers(){
		for(int b=0; b<10; b++){putBeeper();
	}}
	
	private void moveToTarget(){
		move();
	}
}
