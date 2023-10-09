import stanford.karel.SuperKarel;
import stanford.karel.*;

public class FirstToEighth extends Karel {

	@Override
	public void run(){

		tenth();
	
	}
	
	
	private void first(){
		
		move();
		move();
		pickBeeper();
		move();
		putBeeper();
	 
		// run-ში გამოვიძახებთ მეთოდს first()
		
	}


	private void second(){
	
	for(int i=0; i<4; i++){
		
		move();
		
	} //მივა ბიპერებამდე, მეთოდს დავარმევდი moveToBeepers()
	
	for(int i=0; i<10; i++){
		
		pickBeeper();
		
	} //აიღებს იმ 10 ცალ ბიპერს, მეთოდს დავარქმევდი pickTenBeepers()
	
	move();
	
	for(int j=0; j<10; j++){
		
		putBeeper();
		
	} //დადებს იმ 10 ცალ ბიპერს, მეთოდს დავარქმევდი putTenBeepers()
	
	
	// run-ში გამოვიძახებთ მეთოდს second()
	
	}
	
	private void third(){
		
		while(frontIsClear()){
			move();
		}
	 
		// run-ში გამოვიძახებთ მეთოდს third()
		
	}
	
	private void fourth(){
		
		putBeeper();
		
		while(frontIsClear()){
			move();
			putBeeper();
		}
	 
		// run-ში გამოვიძახებთ მეთოდს fourth()
		
	}
	
	private void fifth(){
		
		if(noBeepersPresent()) {
			putBeeper(); 
			move();
			} else move();
		
		while(frontIsClear()){
			if(noBeepersPresent()) {
				putBeeper(); 
				move();
			} else move();
				
		}
		
		putBeeper();
	 
		// run-ში გამოვიძახებთ მეთოდს fifth()
		
	}
	
	private void sixth(){
		
		move();
		
		while(beepersPresent()){
			pickBeeper();
			move();
			move();
			putBeeper();
			turnLeft();
			turnLeft();
			move();
			move();
			turnLeft();
			turnLeft();
		} //2*1 წერტილიდან აიღებს ბიპერებს იქამდე სანამ ბიპერი იქნება 2*1ზე და გადაიტანს 4*1ზე
		
		move();
		
		while(beepersPresent()){
			pickBeeper();
			move();
			putBeeper();
			turnLeft();
			turnLeft();
			move();
			turnLeft();
			turnLeft();
		}//3*1 წერტილიდან აიღებს ბიპერებს იქამდე სანამ ბიპერი იქნება 3*1ზე და გადაიტანს 4*1ზე
		
		move();
		move();
		
		// run-ში გამოვიძახებთ მეთოდს sixth()
		
	}

	private void seventh(){
		
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
		// run-ში გამოვიძახებთ მეთოდს seventh()	 			
	}
	 
	private void eightth(){
		
		move();
		move();
		
		while(beepersPresent()){
			pickBeeper();
			turnLeft();
			turnLeft();
			move();
			pickBeeper();
			turnLeft();
			turnLeft();
			move();
			
		} //3*1 წერტილიდან აიღებს ბიპერებს იქამდე სანამ ბიპერი იქნება 3*1ზე და ამ რაოდენობის ბიპერებს აიღებს 2*1დანაც
		
		turnLeft();
		turnLeft();
		move();
		turnLeft();
		turnLeft();
		
		while(beepersPresent()){
			pickBeeper();
			move();
			move();
			putBeeper();
			turnLeft();
			turnLeft();
			move();
			move();
			turnLeft();
			turnLeft();
			
		}//2*1 წერტილიდან აიღებს ბიპერებს იქამდე სანამ ბიპერი იქნება 2*1ზე და გადაიტანს 4*1ზე
		
		move();
		move();
		
		// run-ში გამოვიძახებთ მეთოდს eightth()
		
	}
	
	private void ninth(){
		
		move();
		
		while(beepersPresent()){
			
			pickBeeper();
			move();
			while(beepersPresent()){
				pickBeeper();
				move();
				putBeeper();
				move();
				putBeeper();
				turnLeft();
				turnLeft();
				move();
				move();
				turnLeft();
				turnLeft();
			}
			move();
			move();
			while(beepersPresent()){
				
				pickBeeper();
				turnLeft();
				turnLeft();
				move();
				move();
				turnLeft();
				turnLeft();
				putBeeper();
				move();
				move();
			
			}
			turnLeft();
			turnLeft();
			move();
			move();
			move();
			turnLeft();
			turnLeft();
			if(noBeepersPresent()){
				move();
				while(beepersPresent()){
					pickBeeper();
				} 
			}
		}
	 
		// run-ში გამოვიძახებთ მეთოდს ninth()
	}
	
	private void tenth(){
		
		move();
		move();
		
		while(beepersPresent()){
			
			pickBeeper();
			move();
			move();
			putBeeper();
			turnLeft();
			turnLeft();
			move();
			move();
			move();
			turnLeft();
			turnLeft();
			pickBeeper();
			move();
			if(noBeepersPresent()){
				move();
				putBeeper();
				turnLeft();
				turnLeft();
				move();
				turnLeft();
				turnLeft();
				move();
				move();
				while(beepersPresent()){
					pickBeeper();
					turnLeft();
					turnLeft();
					move();
					move();
					putBeeper();
					turnLeft();
					turnLeft();
					move();
					move();
				}
			}
			
		}
	 
		// run-ში გამოვიძახებთ მეთოდს tenth()
		
	}
	
	
}